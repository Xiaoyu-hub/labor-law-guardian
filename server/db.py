# -*- coding: utf-8 -*-
"""db.py —— SQLite 数据访问层（标准库 sqlite3，零第三方依赖）"""
import os
import sqlite3
from flask import g, current_app

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'labs.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nickname      TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS check_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT,
    text       TEXT NOT NULL,
    hit_count  INTEGER NOT NULL DEFAULT 0,
    score      INTEGER NOT NULL DEFAULT 100,
    level      TEXT NOT NULL DEFAULT 'low',
    findings   TEXT,                       -- JSON 数组（规则 id/标题/严重度/引用片段）
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS calc_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT,
    inputs     TEXT NOT NULL,              -- JSON
    result     TEXT NOT NULL,              -- JSON（金额汇总）
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS quiz_scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score      INTEGER NOT NULL,
    total      INTEGER NOT NULL DEFAULT 12,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS checkins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day        TEXT NOT NULL,              -- YYYY-MM-DD（本地日期）
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE (user_id, day)
);

CREATE TABLE IF NOT EXISTS qa_posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS qa_replies (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL REFERENCES qa_posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_check_user ON check_history(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_calc_user ON calc_history(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_scores(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_ud ON checkins(user_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_qa_created ON qa_posts(id DESC);
"""


def ensure_dir():
    d = os.path.dirname(DB_PATH)
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)


def get_db():
    """每个请求一个连接，存于 flask.g（请求结束自动关闭）"""
    if 'db' not in g:
        ensure_dir()
        path = current_app.config.get('DB_PATH') or DB_PATH
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        g.db = conn
    return g.db


def close_db(e=None):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


def init_db(path=None):
    ensure_dir()
    conn = sqlite3.connect(path or DB_PATH)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def rows_to_dicts(rows):
    return [dict(r) for r in rows]