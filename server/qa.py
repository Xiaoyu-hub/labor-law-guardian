# -*- coding: utf-8 -*-
"""qa.py —— M6：学法问答板（发帖 / 回复 / 列表，只追加不删除）"""
from flask import Blueprint, jsonify, request

from .db import get_db
from .auth import login_required, current_user

bp = Blueprint('qa', __name__)

TITLE_MAX = 60
CONTENT_MAX = 2000
REPLY_MAX = 1000


@bp.get('/qa')
def list_posts():
    conn = get_db()
    posts = conn.execute(
        'SELECT p.id, p.title, p.content, p.created_at, '
        '       u.username, u.nickname, '
        '       (SELECT COUNT(*) FROM qa_replies r WHERE r.post_id = p.id) AS reply_count '
        'FROM qa_posts p JOIN users u ON u.id = p.user_id '
        'ORDER BY p.id DESC LIMIT 50').fetchall()
    result = []
    for p in posts:
        replies = conn.execute(
            'SELECT r.content, r.created_at, u.username, u.nickname '
            'FROM qa_replies r JOIN users u ON u.id = r.user_id '
            'WHERE r.post_id = ? ORDER BY r.id ASC LIMIT 20', (p['id'],)).fetchall()
        d = dict(p)
        d['replies'] = [dict(r) for r in replies]
        result.append(d)
    return jsonify({'ok': True, 'posts': result})


@bp.post('/qa')
@login_required
def create_post():
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    content = (data.get('content') or '').strip()
    if not title or len(title) > TITLE_MAX:
        return jsonify({'ok': False, 'error': '标题为 1-%d 字' % TITLE_MAX}), 400
    if not content or len(content) > CONTENT_MAX:
        return jsonify({'ok': False, 'error': '内容为 1-%d 字' % CONTENT_MAX}), 400
    user = current_user()
    conn = get_db()
    cur = conn.execute('INSERT INTO qa_posts (user_id, title, content) VALUES (?, ?, ?)',
                       (user['id'], title, content))
    conn.commit()
    return jsonify({'ok': True, 'post_id': cur.lastrowid}), 201


@bp.post('/qa/<int:post_id>/reply')
@login_required
def reply_post(post_id):
    data = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content or len(content) > REPLY_MAX:
        return jsonify({'ok': False, 'error': '回复为 1-%d 字' % REPLY_MAX}), 400
    conn = get_db()
    post = conn.execute('SELECT id FROM qa_posts WHERE id = ?', (post_id,)).fetchone()
    if post is None:
        return jsonify({'ok': False, 'error': '帖子不存在'}), 404
    user = current_user()
    conn.execute('INSERT INTO qa_replies (post_id, user_id, content) VALUES (?, ?, ?)',
                 (post_id, user['id'], content))
    conn.commit()
    return jsonify({'ok': True}), 201