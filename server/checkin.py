# -*- coding: utf-8 -*-
"""checkin.py —— M5：每日学法打卡 + 连续天数（streak）
   打卡按用户+自然日唯一；重复打卡幂等返回 already=True
"""
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from .db import get_db
from .auth import login_required, current_user

bp = Blueprint('checkin', __name__)


def compute_streak(conn, user_id, today=None):
    """连续打卡天数：从今天往前数；若今天未打则从昨天起算（保留宽限）"""
    today = today or date.today()
    days = {r['day'] for r in conn.execute(
        'SELECT day FROM checkins WHERE user_id = ?', (user_id,)).fetchall()}
    d = today
    if d.isoformat() not in days:
        d -= timedelta(days=1)
    streak = 0
    while d.isoformat() in days:
        streak += 1
        d -= timedelta(days=1)
    return streak


@bp.post('/checkin')
@login_required
def checkin():
    user = current_user()
    day = date.today().isoformat()
    conn = get_db()
    exists = conn.execute('SELECT id FROM checkins WHERE user_id = ? AND day = ?',
                          (user['id'], day)).fetchone()
    if exists:
        streak = compute_streak(conn, user['id'])
        return jsonify({'ok': True, 'already': True, 'day': day, 'streak': streak})
    conn.execute('INSERT INTO checkins (user_id, day) VALUES (?, ?)', (user['id'], day))
    conn.commit()
    streak = compute_streak(conn, user['id'])
    return jsonify({'ok': True, 'already': False, 'day': day, 'streak': streak}), 201


@bp.get('/checkin')
@login_required
def my_checkins():
    user = current_user()
    days_arg = request.args.get('days', type=int, default=120)
    days_arg = min(max(days_arg, 7), 365)
    since = (date.today() - timedelta(days=days_arg - 1)).isoformat()
    conn = get_db()
    rows = conn.execute(
        'SELECT day FROM checkins WHERE user_id = ? AND day >= ? ORDER BY day',
        (user['id'], since)).fetchall()
    total = conn.execute('SELECT COUNT(*) AS n FROM checkins WHERE user_id = ?',
                         (user['id'],)).fetchone()['n']
    return jsonify({'ok': True, 'streak': compute_streak(conn, user['id']),
                    'total': total, 'days': [r['day'] for r in rows]})