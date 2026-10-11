# -*- coding: utf-8 -*-
"""history.py —— M3：体检 / 计算历史记录 API（登录用户私有数据）
   - 无权限模型：记录归属当前登录用户，跨用户不可读/删（属主校验）
"""
import json

from flask import Blueprint, jsonify, request

from .db import get_db
from .auth import login_required, current_user

bp = Blueprint('history', __name__)

MAX_TEXT = 100_000     # 合同文本上限
MAX_FINDINGS = 100     # 发现条数上限


def _own_check(conn, user_id, check_id):
    return conn.execute(
        'SELECT * FROM check_history WHERE id = ? AND user_id = ?', (check_id, user_id)).fetchone()


# ---------------- 体检历史 ----------------
@bp.post('/history/check')
@login_required
def save_check():
    data = request.get_json(silent=True) or {}
    text = data.get('text') or ''
    if not text.strip():
        return jsonify({'ok': False, 'error': '合同文本为空'}), 400
    if len(text) > MAX_TEXT:
        return jsonify({'ok': False, 'error': '合同文本过长（上限 100KB）'}), 400

    findings = data.get('findings') or []
    if len(findings) > MAX_FINDINGS:
        findings = findings[:MAX_FINDINGS]

    user = current_user()
    title = (data.get('title') or '').strip()[:40] or '合同体检 @ ' + user['username']
    conn = get_db()
    cur = conn.execute(
        'INSERT INTO check_history (user_id, title, text, hit_count, score, level, findings) '
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
        (user['id'], title, text,
         int(data.get('hit_count') or 0),
         int(data.get('score') or 100),
         data.get('level') or 'low',
         json.dumps(findings, ensure_ascii=False)))
    conn.commit()
    row = conn.execute(
        'SELECT id, title, hit_count, score, level, created_at FROM check_history WHERE id = ?',
        (cur.lastrowid,)).fetchone()
    return jsonify({'ok': True, 'record': dict(row)}), 201


@bp.get('/history/check')
@login_required
def list_checks():
    rows = get_db().execute(
        'SELECT id, title, hit_count, score, level, created_at FROM check_history '
        'WHERE user_id = ? ORDER BY id DESC LIMIT 50', (current_user()['id'],)).fetchall()
    return jsonify({'ok': True, 'records': [dict(r) for r in rows]})


@bp.get('/history/check/<int:check_id>')
@login_required
def get_check(check_id):
    row = _own_check(get_db(), current_user()['id'], check_id)
    if row is None:
        return jsonify({'ok': False, 'error': '记录不存在'}), 404
    rec = dict(row)
    rec['findings'] = json.loads(rec.pop('findings') or '[]')
    return jsonify({'ok': True, 'record': rec})


@bp.delete('/history/check/<int:check_id>')
@login_required
def delete_check(check_id):
    conn = get_db()
    row = _own_check(conn, current_user()['id'], check_id)
    if row is None:
        return jsonify({'ok': False, 'error': '记录不存在'}), 404
    conn.execute('DELETE FROM check_history WHERE id = ?', (check_id,))
    conn.commit()
    return jsonify({'ok': True})


# ---------------- 计算历史 ----------------
@bp.post('/history/calc')
@login_required
def save_calc():
    data = request.get_json(silent=True) or {}
    inputs = json.dumps(data.get('inputs') or {}, ensure_ascii=False)
    result = json.dumps(data.get('result') or {}, ensure_ascii=False)
    if len(inputs) + len(result) > MAX_TEXT:
        return jsonify({'ok': False, 'error': '数据过大'}), 400
    user = current_user()
    title = (data.get('title') or '').strip()[:40] or '权益计算 @ ' + user['username']
    conn = get_db()
    cur = conn.execute(
        'INSERT INTO calc_history (user_id, title, inputs, result) VALUES (?, ?, ?, ?)',
        (user['id'], title, inputs, result))
    conn.commit()
    row = conn.execute('SELECT id, title, created_at FROM calc_history WHERE id = ?',
                       (cur.lastrowid,)).fetchone()
    return jsonify({'ok': True, 'record': dict(row)}), 201


@bp.get('/history/calc')
@login_required
def list_calcs():
    rows = get_db().execute(
        'SELECT id, title, created_at FROM calc_history WHERE user_id = ? ORDER BY id DESC LIMIT 30',
        (current_user()['id'],)).fetchall()
    return jsonify({'ok': True, 'records': [dict(r) for r in rows]})


@bp.get('/history/calc/<int:calc_id>')
@login_required
def get_calc(calc_id):
    row = get_db().execute('SELECT * FROM calc_history WHERE id = ? AND user_id = ?',
                           (calc_id, current_user()['id'])).fetchone()
    if row is None:
        return jsonify({'ok': False, 'error': '记录不存在'}), 404
    rec = dict(row)
    rec['inputs'] = json.loads(rec.pop('inputs') or '{}')
    rec['result'] = json.loads(rec.pop('result') or '{}')
    return jsonify({'ok': True, 'record': rec})


@bp.delete('/history/calc/<int:calc_id>')
@login_required
def delete_calc(calc_id):
    conn = get_db()
    row = conn.execute('SELECT id FROM calc_history WHERE id = ? AND user_id = ?',
                       (calc_id, current_user()['id'])).fetchone()
    if row is None:
        return jsonify({'ok': False, 'error': '记录不存在'}), 404
    conn.execute('DELETE FROM calc_history WHERE id = ?', (calc_id,))
    conn.commit()
    return jsonify({'ok': True})