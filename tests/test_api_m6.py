# -*- coding: utf-8 -*-
"""M6 问答板 API 单元测试
   运行：python -m unittest tests.test_api_m6 -v
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.server import create_app


class QaApiTest(unittest.TestCase):
    def setUp(self):
        fd, self.db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        self.app = create_app({'TESTING': True, 'DB_PATH': self.db_path, 'SECRET_KEY': 'test-secret'})
        self.client = self.app.test_client()
        self.client.post('/api/auth/register', json={'username': 'alice', 'password': 'pass123'})

    def tearDown(self):
        os.unlink(self.db_path)

    def test_post_and_reply_flow(self):
        r = self.client.post('/api/qa', json={'title': '试用期被辞退怎么办？',
                                              'content': '还在试用期，公司说我不适合就辞退了，能要赔偿吗？'})
        self.assertEqual(r.status_code, 201)
        pid = r.get_json()['post_id']

        r2 = self.client.post('/api/qa/%d/reply' % pid,
                              json={'content': '试用期解除也须符合法定情形（如不符合录用条件），否则可能构成违法解除，可主张 2N 赔偿金。'})
        self.assertEqual(r2.status_code, 201)

        posts = self.client.get('/api/qa').get_json()['posts']
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]['title'], '试用期被辞退怎么办？')
        self.assertEqual(posts[0]['username'], 'alice')
        self.assertEqual(posts[0]['reply_count'], 1)
        self.assertEqual(len(posts[0]['replies']), 1)
        self.assertIn('违法解除', posts[0]['replies'][0]['content'])

    def test_anon_visible_but_cannot_post(self):
        anon = self.app.test_client()
        self.assertEqual(anon.get('/api/qa').status_code, 200)
        self.assertEqual(anon.post('/api/qa', json={'title': 't', 'content': 'c'}).status_code, 401)
        anon.post('/api/auth/register', json={'username': 'bobby1', 'password': 'pass123'})
        self.assertEqual(anon.post('/api/qa/999/reply', json={'content': 'x'}).status_code, 404)

    def test_validation(self):
        self.assertEqual(self.client.post('/api/qa', json={'title': '', 'content': 'c'}).status_code, 400)
        self.assertEqual(self.client.post('/api/qa', json={'title': 'x' * 61, 'content': 'c'}).status_code, 400)
        self.assertEqual(self.client.post('/api/qa', json={'title': 't', 'content': ''}).status_code, 400)
        r = self.client.post('/api/qa', json={'title': '合法帖子', 'content': '正文'})
        pid = r.get_json()['post_id']
        self.assertEqual(self.client.post('/api/qa/%d/reply' % pid, json={'content': ''}).status_code, 400)


if __name__ == '__main__':
    unittest.main(verbosity=2)