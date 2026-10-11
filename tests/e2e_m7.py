# -*- coding: utf-8 -*-
"""M7 前端认证链路 e2e：http 模式（注册/登录/登出）+ file:// 降级模式
   前置：后端已在 127.0.0.1:5000 运行（python -m server.server）
"""
import random
import string
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE_HTTP = "http://127.0.0.1:5000/"
BASE_FILE = "file:///D:/work/劳动法治教育/index.html"

suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
UNAME = "demo_" + suffix


def new_page(p, url):
    page = p.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
    page.goto(url, wait_until="load")
    page.wait_for_timeout(400)
    return page, errors


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)

    # ---------- http 后端模式 ----------
    page, errors = new_page(b, BASE_HTTP)
    badge = page.locator("#backendState").inner_text()
    print("badge(未登录):", repr(badge), flush=True)
    page.locator('a[data-view="profile"]').click()
    page.wait_for_selector("#authForm")
    print("auth form ok", flush=True)

    # 注册
    page.locator('[data-auth-tab="register"]').click()
    page.wait_for_selector('#authForm[data-mode="register"]')
    page.locator("#auNick").fill("演示小吴")
    page.locator("#auUser").fill(UNAME)
    page.locator("#auPass").fill("demo123456")
    page.locator("#authForm button[type=submit]").click()
    page.wait_for_selector("#btnLogout", timeout=5000)
    profile = page.locator("#profileBox").inner_text()
    print("after register:", " ".join(profile.split())[:80], flush=True)
    print("badge(已登录):", repr(page.locator("#backendState").inner_text()), flush=True)

    # 登出 → 回到登录表单
    page.locator("#btnLogout").click()
    page.wait_for_selector("#authForm")
    print("logout -> auth form ok", flush=True)

    # 再登录
    page.locator("#auUser").fill(UNAME)
    page.locator("#auPass").fill("demo123456")
    page.locator("#authForm button[type=submit]").click()
    page.wait_for_selector("#btnLogout", timeout=5000)
    print("login again ok", flush=True)
    print("HTTP console errors:", len(errors), flush=True)
    for e in errors:
        print("  ERR:", e, flush=True)
    page.screenshot(path="shots/07_profile_login.png", full_page=False)
    page.close()

    # ---------- file:// 降级模式 ----------
    page2, errors2 = new_page(b, BASE_FILE)
    badge2 = page2.locator("#backendState").inner_text()
    print("file badge:", repr(badge2), flush=True)
    page2.locator('a[data-view="profile"]').click()
    page2.wait_for_selector("#view-profile.active")
    offline = page2.locator("#profileBox").inner_text()
    print("offline card:", "未连接后端服务" in offline, flush=True)
    # 核心模块仍可用：体检
    page2.locator('a[data-view="check"]').click()
    page2.locator("#btnSample").click()
    page2.locator("#btnCheck").click()
    page2.wait_for_selector("#findingList .finding")
    print("file-mode check findings:", page2.locator("#findingList .finding").count(), flush=True)
    print("FILE console errors:", len(errors2), flush=True)
    for e in errors2:
        print("  ERR:", e, flush=True)
    page2.close()

    b.close()
print("--- M7 DONE ---", flush=True)