/* ==========================================================================
   api.js —— 前端与后端的连接层（优雅降级）
   --------------------------------------------------------------------------
   - file:// 直开：探测 /api/health 失败 → backend=false，纯前端模式照常演示
   - http:// 托管：backend=true，解锁账号/历史/排行榜/打卡/问答
   - 所有请求返回 {ok, ...} 或抛 {status, error}
   ========================================================================== */
window.LJ = window.LJ || {};

LJ.API = (function () {
  var state = {
    backend: false,     // 后端是否可达
    user: null,         // 当前登录用户 {id, username, nickname, created_at}
    ready: false        // 初始探测是否完成
  };
  var listeners = [];

  function emit() {
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { } });
  }

  function request(method, url, body) {
    var opts = { method: method, headers: { 'Accept': 'application/json' } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ('HTTP ' + res.status));
          err.status = res.status;
          err.body = data;
          throw err;
        }
        return data;
      });
    });
  }

  /* 初始探测：file:// 直开直接判离线（发 fetch 会被 CORS 拦截产生噪音）；
     http:// 下探测后端在线 + 当前登录态 */
  function init() {
    if (location.protocol === 'file:') {
      state.backend = false;
      state.ready = true;
      emit();
      return Promise.resolve(false);
    }
    return fetch('/api/health', { method: 'GET' })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; })
      .then(function (ok) {
        state.backend = ok;
        if (!ok) { state.ready = true; emit(); return false; }
        return request('GET', '/api/auth/me').then(function (d) {
          state.user = d.user;
          state.ready = true;
          emit();
        }).catch(function () { state.ready = true; emit(); });
      });
  }

  /* ---- 认证 ---- */
  function register(username, password, nickname) {
    return request('POST', '/api/auth/register', { username: username, password: password, nickname: nickname })
      .then(function (d) { state.user = d.user; emit(); return d; });
  }
  function login(username, password) {
    return request('POST', '/api/auth/login', { username: username, password: password })
      .then(function (d) { state.user = d.user; emit(); return d; });
  }
  function logout() {
    return request('POST', '/api/auth/logout').then(function () {
      state.user = null; emit();
    });
  }

  /* ---- 体检历史 ---- */
  function saveCheck(payload) {
    return request('POST', '/api/history/check', payload);
  }
  function listChecks() {
    return request('GET', '/api/history/check');
  }
  function getCheck(id) {
    return request('GET', '/api/history/check/' + id);
  }
  function deleteCheck(id) {
    return request('DELETE', '/api/history/check/' + id);
  }

  /* ---- 计算历史 ---- */
  function saveCalc(payload) {
    return request('POST', '/api/history/calc', payload);
  }
  function listCalcs() {
    return request('GET', '/api/history/calc');
  }
  function getCalc(id) {
    return request('GET', '/api/history/calc/' + id);
  }
  function deleteCalc(id) {
    return request('DELETE', '/api/history/calc/' + id);
  }

  /* ---- 闯关 ---- */
  function submitQuizScore(score, total) {
    return request('POST', '/api/quiz/score', { score: score, total: total });
  }
  function leaderboard() {
    return request('GET', '/api/quiz/leaderboard');
  }
  function myScores() {
    return request('GET', '/api/quiz/mine');
  }

  /* ---- 打卡 ---- */
  function checkin() {
    return request('POST', '/api/checkin');
  }
  function myCheckins() {
    return request('GET', '/api/checkin?days=150');
  }

  /* ---- 问答板 ---- */
  function listQa() {
    return request('GET', '/api/qa');
  }
  function postQa(title, content) {
    return request('POST', '/api/qa', { title: title, content: content });
  }
  function replyQa(postId, content) {
    return request('POST', '/api/qa/' + postId + '/reply', { content: content });
  }

  function onChange(fn) {
    listeners.push(fn);
    if (state.ready) fn(state);
  }

  return {
    state: state, init: init, request: request, onChange: onChange,
    register: register, login: login, logout: logout,
    saveCheck: saveCheck, listChecks: listChecks, getCheck: getCheck, deleteCheck: deleteCheck,
    saveCalc: saveCalc, listCalcs: listCalcs, getCalc: getCalc, deleteCalc: deleteCalc,
    submitQuizScore: submitQuizScore, leaderboard: leaderboard, myScores: myScores,
    checkin: checkin, myCheckins: myCheckins,
    listQa: listQa, postQa: postQa, replyQa: replyQa
  };
})();

/* 顶部状态条：后端在线 + 登录用户 或 离线提示 */
LJ.renderBackendBadge = function () {
  var el = document.getElementById('backendState');
  if (!el) return;
  var s = LJ.API.state;
  if (!s.ready) {
    el.innerHTML = '<span class="badge badge-info">⏳ 连接检测中…</span>';
  } else if (!s.backend) {
    el.innerHTML = '<span class="badge badge-info" title="当前为纯前端模式；运行 python -m server.server 后刷新即可解锁账号/历史/打卡/问答">● 本地引擎模式</span>';
  } else if (s.user) {
    el.innerHTML = '<span class="badge badge-low">● ' + LJ.escapeHtml(s.user.nickname || s.user.username) + '</span>';
  } else {
    el.innerHTML = '<span class="badge badge-info">● 未登录</span>';
  }
};