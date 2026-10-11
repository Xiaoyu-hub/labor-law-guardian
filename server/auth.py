# -*- coding: utf-8 -*-
"""auth.py —— M2：注册 / 登录 / 登出 / 当前用户
   密码：pbkdf2_hmac(sha256, 20 万次迭代) + 随机盐，仅存哈希
   会话：Flask signed cookie session（仅存 uid）
"""
import hashlib
import hmac
import os
import re
import functools

from flask import Blueprint, jsonify, request, session, g

from .db import get_db, rows_to_dicts

bp = Blueprint('auth', __name__)

USERNAME_RE = re.compile(r'^[A-Za-z0-9_]{3,20}$')
PBKDF2_ITER = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, PBKDF2_ITER)
    return 'pbkdf2:sha256:{}${}${}'.format(PBKDF2_ITER, salt.hex(), digest.hex())


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, hash_hex = stored.split('$')   # 格式: pbkdf2:sha256:200000$salt$hash（3 段）
        salt = bytes.fromhex(salt_hex)
        expect = bytes.fromhex(hash_hex)
    except (ValueError, AttributeError):
        return False
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, PBKDF2_ITER)
    return hmac.compare_digest(digest, expect)


def login_required(fn):
    """需要登录的接口装饰器：未登录返回 401 JSON"""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if 'uid' not in session:
            return jsonify({'ok': False, 'error': '请先登录'}), 401
        return fn(*args, **kwargs)
    return wrapper


def current_user():
    """返回当前登录用户 dict，未登录返回 None"""
    if 'uid' not in session:
        return None
    row = get_db().execute('SELECT id, username, nickname, created_at FROM users WHERE id = ?',
                           (session['uid'],)).fetchone()
    return dict(row) if row else None


@bp.post('/register')
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    nickname = (data.get('nickname') or '').strip()[:20] or username

    if not USERNAME_RE.match(username):
        return jsonify({'ok': False, 'error': '用户名需为 3-20 位字母/数字/下划线'}), 400
    if len(password) < 6:
        return jsonify({'ok': False, 'error': '密码至少 6 位'}), 400

    conn = get_db()
    exists = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if exists:
        return jsonify({'ok': False, 'error': '用户名已被注册'}), 409

    conn.execute('INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)',
                 (username, hash_password(password), nickname))
    conn.commit()
    user = conn.execute('SELECT id, username, nickname, created_at FROM users WHERE username = ?',
                        (username,)).fetchone()
    session['uid'] = user['id']
    return jsonify({'ok': True, 'user': dict(user)}), 201


@bp.post('/login')
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    row = get_db().execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if row is None or not verify_password(password, row['password_hash']):
        return jsonify({'ok': False, 'error': '用户名或密码错误'}), 401
    session['uid'] = row['id']
    return jsonify({'ok': True, 'user': {'id': row['id'], 'username': row['username'],
                                         'nickname': row['nickname'], 'created_at': row['created_at']}})


@bp.post('/logout')
def logout():
    session.clear()
    return jsonify({'ok': True})


@bp.get('/me')
def me():
    """未登录返回 {user: null}，前端据此判断后端可用性与登录态"""
    user = current_user()
    return jsonify({'ok': True, 'user': user})