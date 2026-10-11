# -*- coding: utf-8 -*-
"""M5 打卡 API 单元测试
   运行：python -m unittest tests.test_api_m5 -v
"""
import os
import sys
import tempfile
import unittest
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.server import create_app
from server.checkin import compute_streak


class CheckinApiTest(unittest.TestCase):
    def setUp(self):
        fd, self.db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        self.app = create_app({'TESTING': True, 'DB_PATH': self.db_path, 'SECRET_KEY': 'test-secret'})
        self.client = self.app.test_client()
        self.client.post('/api/auth/register', json={'username': 'alice', 'password': 'pass123'})

    def tearDown(self):
        os.unlink(self.db_path)

    def test_checkin_today_and_idempotent(self):
        r = self.client.post('/api/checkin')
        self.assertEqual(r.status_code, 201)
        body = r.get_json()
        self.assertFalse(body['already'])
        self.assertEqual(body['streak'], 1)
        # 重复打卡 → 幂等
        r2 = self.client.post('/api/checkin')
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.get_json()['already'])

    def test_streak_counts_consecutive_days(self):
        self.client.post('/api/checkin')  # 今天
        import sqlite3
        db = sqlite3.connect(self.db_path)
        try:
            today = date.today()
            for back in (1, 2, 4):
                db.execute("INSERT INTO checkins (user_id, day) VALUES (1, ?)",
                           ((today - timedelta(days=back)).isoformat(),))
            db.commit()
        finally:
            db.close()
        body = self.client.get('/api/checkin').get_json()
        self.assertEqual(body['total'], 4)
        self.assertEqual(body['streak'], 3)   # 今天+昨天+前天，中间断 1 天
        self.assertEqual(len(body['days']), 4)

    def test_compute_streak_with_yesterday_grace(self):
        """今天未打卡但有昨天 → 从昨天起算 = 1（宽限逻辑）"""
        import sqlite3
        db = sqlite3.connect(self.db_path)
        db.row_factory = sqlite3.Row
        try:
            db.execute("INSERT INTO checkins (user_id, day) VALUES (1, ?)",
                       ((date.today() - timedelta(days=1)).isoformat(),))
            db.commit()
        finally:
            db.close()

        # 用内存桩验证 compute_streak（避免测试桩持有未关闭的 sqlite 连接锁文件）
        db = None
        try:
            db = sqlite3.connect(self.db_path)
            db.row_factory = sqlite3.Row
            rows = [dict(r) for r in db.execute(
                'SELECT day FROM checkins WHERE user_id = 1').fetchall()]
        finally:
            if db:
                db.close()

        class FakeConn:
            def __init__(self, rows):
                self.rows = rows

            def execute(self, *a, **k):
                class Cursor:
                    def fetchall(self):
                        return rows
                return Cursor()

        self.assertEqual(compute_streak(FakeConn(rows), 1), 1)

    def test_checkin_requires_login(self):
        anon = self.app.test_client()
        self.assertEqual(anon.post('/api/checkin').status_code, 401)
        self.assertEqual(anon.get('/api/checkin').status_code, 401)


if __name__ == '__main__':
    unittest.main(verbosity=2)