# -*- coding: utf-8 -*-
"""M2 认证 API 单元测试（Flask test client + 临时 SQLite 库）
   运行：python -m unittest tests.test_api_m2 -v
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.server import create_app


class AuthApiTest(unittest.TestCase):
    def setUp(self):
        fd, self.db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        self.app = create_app({'TESTING': True, 'DB_PATH': self.db_path,
                               'SECRET_KEY': 'test-secret'})
        self.client = self.app.test_client()

    def tearDown(self):
        os.unlink(self.db_path)

    def post(self, url, **json):
        return self.client.post(url, json=json)

    # ---------- 注册 ----------
    def test_register_ok(self):
        r = self.post('/api/auth/register', username='demo', password='demo123', nickname='演示员')
        self.assertEqual(r.status_code, 201)
        body = r.get_json()
        self.assertTrue(body['ok'])
        self.assertEqual(body['user']['username'], 'demo')
        self.assertEqual(body['user']['nickname'], '演示员')
        me = self.client.get('/api/auth/me').get_json()
        self.assertEqual(me['user']['username'], 'demo')   # 注册后即登录

    def test_register_duplicate(self):
        self.post('/api/auth/register', username='dup', password='123456')
        r = self.post('/api/auth/register', username='dup', password='123456')
        self.assertEqual(r.status_code, 409)

    def test_register_bad_username_and_short_pwd(self):
        self.assertEqual(self.post('/api/auth/register', username='ab', password='123456').status_code, 400)
        self.assertEqual(self.post('/api/auth/register', username='good1', password='123').status_code, 400)
        self.assertEqual(self.post('/api/auth/register', username='bad name!', password='123456').status_code, 400)

    def test_password_hashed_with_salt(self):
        self.post('/api/auth/register', username='user_one', password='secret1')
        self.post('/api/auth/logout')
        self.post('/api/auth/register', username='user_two', password='secret1')  # 同密码不同盐
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        rows = conn.execute('SELECT password_hash FROM users ORDER BY id').fetchall()
        conn.close()
        self.assertEqual(len(rows), 2)
        self.assertNotEqual(rows[0][0], rows[1][0])              # 盐随机
        self.assertIn('pbkdf2:sha256:200000$', rows[0][0])       # 明文不落库
        self.assertNotIn('secret1', rows[0][0])

    # ---------- 登录 / 登出 ----------
    def test_login_logout_flow(self):
        self.post('/api/auth/register', username='alice', password='pass123')
        self.client.post('/api/auth/logout')
        self.assertIsNone(self.client.get('/api/auth/me').get_json()['user'])

        bad = self.post('/api/auth/login', username='alice', password='wrong')
        self.assertEqual(bad.status_code, 401)

        good = self.post('/api/auth/login', username='alice', password='pass123')
        self.assertEqual(good.status_code, 200)
        self.assertEqual(good.get_json()['user']['username'], 'alice')
        self.assertIsNotNone(self.client.get('/api/auth/me').get_json()['user'])
        self.client.post('/api/auth/logout')
        self.assertIsNone(self.client.get('/api/auth/me').get_json()['user'])

    def test_health(self):
        r = self.client.get('/api/health')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.get_json()['ok'])


if __name__ == '__main__':
    unittest.main(verbosity=2)