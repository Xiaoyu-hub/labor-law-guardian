# -*- coding: utf-8 -*-
"""M4 闯关成绩 / 排行榜 API 单元测试
   运行：python -m unittest tests.test_api_m4 -v
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.server import create_app


class QuizApiTest(unittest.TestCase):
    def setUp(self):
        fd, self.db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        self.app = create_app({'TESTING': True, 'DB_PATH': self.db_path, 'SECRET_KEY': 'test-secret'})
        self.alice = self.app.test_client()
        self.alice.post('/api/auth/register', json={'username': 'alice', 'password': 'pass123'})

    def tearDown(self):
        os.unlink(self.db_path)

    def test_submit_score_and_best(self):
        r = self.alice.post('/api/quiz/score', json={'score': 9, 'total': 12})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.get_json()['best'], 9)
        self.alice.post('/api/quiz/score', json={'score': 11, 'total': 12})
        r2 = self.alice.post('/api/quiz/score', json={'score': 8, 'total': 12})
        self.assertEqual(r2.get_json(), {'ok': True, 'best': 11, 'games': 3})

    def test_score_validation(self):
        for bad in [{'score': -1, 'total': 12}, {'score': 13, 'total': 12},
                    {'score': 'x', 'total': 12}, {'score': 5, 'total': 0}]:
            self.assertEqual(self.alice.post('/api/quiz/score', json=bad).status_code, 400)

    def test_leaderboard_ranked(self):
        bob = self.app.test_client()
        bob.post('/api/auth/register', json={'username': 'bobby1', 'password': 'pass123'})
        self.alice.post('/api/quiz/score', json={'score': 10, 'total': 12})
        bob.post('/api/quiz/score', json={'score': 12, 'total': 12})
        lb = bob.get('/api/quiz/leaderboard').get_json()['leaderboard']
        self.assertEqual(len(lb), 2)
        self.assertEqual(lb[0]['username'], 'bobby1')   # 12 分居首
        self.assertEqual(lb[0]['best'], 12)
        self.assertEqual(lb[1]['username'], 'alice')
        self.assertEqual(lb[0]['games'], 1)

    def test_leaderboard_public_but_mine_private(self):
        anon = self.app.test_client()
        self.assertEqual(anon.get('/api/quiz/leaderboard').status_code, 200)
        self.assertEqual(anon.get('/api/quiz/mine').status_code, 401)


if __name__ == '__main__':
    unittest.main(verbosity=2)