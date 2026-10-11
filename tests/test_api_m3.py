# -*- coding: utf-8 -*-
"""M3 历史记录 API 单元测试
   覆盖：保存/列表/详情/删除、未登录 401、跨用户不可见不可删
   运行：python -m unittest tests.test_api_m3 -v
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.server import create_app

SAMPLE_FINDINGS = [
    {'id': 'probation_over_6m', 'title': '试用期超过法定上限', 'severity': 'high', 'quote': '试用期为 5 个月'},
    {'id': 'si_waiver', 'title': '约定放弃缴纳社会保险', 'severity': 'high', 'quote': '员工自愿放弃缴纳社会保险'},
]


class HistoryApiTest(unittest.TestCase):
    def setUp(self):
        fd, self.db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        self.app = create_app({'TESTING': True, 'DB_PATH': self.db_path, 'SECRET_KEY': 'test-secret'})
        self.client = self.app.test_client()
        self.login('alice', 'pass123')

    def tearDown(self):
        os.unlink(self.db_path)

    def login(self, username, password):
        r = self.client.post('/api/auth/register', json={'username': username, 'password': password})
        self.assertEqual(r.status_code, 201, r.get_json())

    # ------------------ 体检历史 ------------------
    def test_save_and_list_check(self):
        r = self.client.post('/api/history/check', json={
            'title': '我的第一份合同', 'text': '试用期为 5 个月。',
            'hit_count': 2, 'score': 56, 'level': 'high', 'findings': SAMPLE_FINDINGS})
        self.assertEqual(r.status_code, 201)
        rec = r.get_json()['record']
        self.assertTrue(rec['id'] > 0)

        lst = self.client.get('/api/history/check').get_json()['records']
        self.assertEqual(len(lst), 1)
        self.assertEqual(lst[0]['title'], '我的第一份合同')
        self.assertEqual(lst[0]['level'], 'high')

        detail = self.client.get('/api/history/check/%d' % rec['id']).get_json()['record']
        self.assertEqual(detail['text'], '试用期为 5 个月。')
        self.assertEqual(len(detail['findings']), 2)
        self.assertEqual(detail['findings'][0]['severity'], 'high')

    def test_delete_check(self):
        r = self.client.post('/api/history/check', json={'text': 'xxx', 'findings': []})
        cid = r.get_json()['record']['id']
        self.assertEqual(self.client.delete('/api/history/check/%d' % cid).status_code, 200)
        self.assertEqual(self.client.get('/api/history/check/%d' % cid).status_code, 404)

    def test_history_requires_login(self):
        other = self.app.test_client()
        self.assertEqual(other.get('/api/history/check').status_code, 401)
        self.assertEqual(other.post('/api/history/check', json={'text': 'x'}).status_code, 401)

    def test_cross_user_isolation(self):
        r = self.client.post('/api/history/check', json={'text': 'alice 的合同', 'findings': []})
        cid = r.get_json()['record']['id']
        bob = self.app.test_client()
        rj = bob.post('/api/auth/register', json={'username': 'bob_1', 'password': 'pass123'})
        self.assertEqual(rj.status_code, 201)
        # bob 读不到、删不掉 alice 的记录
        self.assertEqual(bob.get('/api/history/check/%d' % cid).status_code, 404)
        self.assertEqual(bob.delete('/api/history/check/%d' % cid).status_code, 404)
        # alice 本人仍可读
        self.assertEqual(self.client.get('/api/history/check/%d' % cid).status_code, 200)

    def test_bad_payloads(self):
        self.assertEqual(self.client.post('/api/history/check', json={'text': ''}).status_code, 400)
        self.assertEqual(self.client.post('/api/history/check', json={'text': 'x' * 200000}).status_code, 400)

    # ------------------ 计算历史 ------------------
    def test_calc_history_flow(self):
        r = self.client.post('/api/history/calc', json={
            'title': '加班费测算', 'inputs': {'monthly': 8000, 'ot': [20, 32, 8]},
            'result': {'total': 5425.29}})
        self.assertEqual(r.status_code, 201)
        lst = self.client.get('/api/history/calc').get_json()['records']
        self.assertEqual(len(lst), 1)
        detail = self.client.get('/api/history/calc/%d' % lst[0]['id']).get_json()['record']
        self.assertEqual(detail['inputs']['monthly'], 8000)
        self.assertEqual(detail['result']['total'], 5425.29)
        self.assertEqual(self.client.delete('/api/history/calc/%d' % lst[0]['id']).status_code, 200)
        self.assertEqual(self.client.get('/api/history/calc/%d' % lst[0]['id']).status_code, 404)


if __name__ == '__main__':
    unittest.main(verbosity=2)