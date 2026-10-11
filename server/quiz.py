# -*- coding: utf-8 -*-
"""quiz.py —— M4：闯关成绩提交 + 排行榜 + 我的成绩"""
from flask import Blueprint, jsonify, request

from .db import get_db
from .auth import login_required, current_user

bp = Blueprint('quiz', __name__)


@bp.post('/quiz/score')
@login_required
def submit_score():
    data = request.get_json(silent=True) or {}
    try:
        score = int(data.get('score'))
        total_v = data.get('total')
        total = 12 if total_v is None else int(total_v)   # 不能用 `or 12`：total=0 会被短路
    except (TypeError, ValueError):
        return jsonify({'ok': False, 'error': '成绩格式错误'}), 400
    if score < 0 or total <= 0 or score > total or total > 100:
        return jsonify({'ok': False, 'error': '成绩超出合法范围'}), 400

    user = current_user()
    conn = get_db()
    conn.execute('INSERT INTO quiz_scores (user_id, score, total) VALUES (?, ?, ?)',
                 (user['id'], score, total))
    conn.commit()
    best = conn.execute(
        'SELECT MAX(score) AS best, COUNT(*) AS games FROM quiz_scores WHERE user_id = ?',
        (user['id'],)).fetchone()
    return jsonify({'ok': True, 'best': best['best'], 'games': best['games']}), 201


@bp.get('/quiz/leaderboard')
def leaderboard():
    rows = get_db().execute(
        'SELECT u.username, u.nickname, MAX(q.score) AS best, COUNT(q.id) AS games, '
        '       MAX(q.created_at) AS last_at '
        'FROM quiz_scores q JOIN users u ON u.id = q.user_id '
        'GROUP BY q.user_id ORDER BY best DESC, games ASC LIMIT 10').fetchall()
    return jsonify({'ok': True, 'leaderboard': [dict(r) for r in rows]})


@bp.get('/quiz/mine')
@login_required
def my_scores():
    rows = get_db().execute(
        'SELECT score, total, created_at FROM quiz_scores WHERE user_id = ? ORDER BY id DESC LIMIT 20',
        (current_user()['id'],)).fetchall()
    best = get_db().execute('SELECT MAX(score) AS best, COUNT(*) AS games FROM quiz_scores WHERE user_id = ?',
                            (current_user()['id'],)).fetchone()
    return jsonify({'ok': True, 'records': [dict(r) for r in rows],
                    'best': best['best'], 'games': best['games']})