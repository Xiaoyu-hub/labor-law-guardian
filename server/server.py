# -*- coding: utf-8 -*-
"""server.py —— 《劳动法治护航》后端入口
   M1 骨架：Flask app 工厂 + 健康检查 + 静态托管（前端 index.html 与 assets）
   运行（项目根目录执行）：python -m server.server  →  http://127.0.0.1:5000
"""
import os
from flask import Flask, jsonify, send_from_directory

from . import db, auth, history, quiz, checkin, qa

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    app.config['SECRET_KEY'] = os.environ.get('LAB_SECRET_KEY', 'dev-only-secret-key')
    app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # 请求体上限 2MB

    if test_config:
        app.config.update(test_config)

    db.init_db(app.config.get('DB_PATH'))
    app.teardown_appcontext(db.close_db)

    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    app.register_blueprint(history.bp, url_prefix='/api')
    app.register_blueprint(quiz.bp, url_prefix='/api')
    app.register_blueprint(checkin.bp, url_prefix='/api')
    app.register_blueprint(qa.bp, url_prefix='/api')

    @app.get('/api/health')
    def health():
        return jsonify({'ok': True, 'service': 'labor-law-guardian', 'version': '1.1.0'})

    # ---- 前端静态托管（与 file:// 直开共用同一份代码） ----
    @app.get('/')
    def index():
        return send_from_directory(ROOT, 'index.html')

    @app.get('/assets/<path:filename>')
    def assets(filename):
        return send_from_directory(os.path.join(ROOT, 'assets'), filename)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='127.0.0.1', port=5000, debug=False)