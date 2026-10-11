# -*- coding: utf-8 -*-
"""M9 问答板 e2e：发帖 → 列表 → 回复 → 回复数；0 console error
   前置：后端 127.0.0.1:5000
"""
import random
import string
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "http://127.0.0.1:5000/"
suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
UNAME = "qa_" + suffix
TITLE = "试用期长度问题-" + suffix

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)
    page = b.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(400)

    # 未登录浏览问答（应显示登录提示而非发帖表单）
    page.locator('a[data-view="qa"]').click()
    page.wait_for_selector(".notice:has-text('要')", timeout=5000)
    print("anon view ok (no form)", flush=True)

    # 注册后发帖
    page.locator('a[data-view="profile"]').click()
    page.wait_for_selector("#authForm")
    page.locator('[data-auth-tab="register"]').click()
    page.locator("#auNick").fill("问答测试员")
    page.locator("#auUser").fill(UNAME)
    page.locator("#auPass").fill("demo123456")
    page.locator("#authForm button[type=submit]").click()
    page.wait_for_selector("#btnCheckin", timeout=5000)

    page.locator('a[data-view="qa"]').click()
    page.wait_for_selector("#qaForm", timeout=5000)
    page.locator("#qaTitle").fill(TITLE)
    page.locator("#qaContent").fill("劳动合同期限 1 年，试用期约定 3 个月是否合法？")
    page.locator("#qaForm button[type=submit]").click()
    page.wait_for_selector(".qa-post:has-text('" + TITLE + "')", timeout=5000)
    print("post visible in list", flush=True)

    # 回复
    page.locator(".qa-post:has-text('" + TITLE + "') [data-reply-toggle]").click()
    page.locator(".qa-post:has-text('" + TITLE + "') .qaReplyText").fill("不合法：1 年期合同试用期不得超过 1 个月（劳动合同法第十九条）。")
    page.locator(".qa-post:has-text('" + TITLE + "') .qaReplyForm button").click()
    page.wait_for_selector(".qa-post:has-text('" + TITLE + "') .qa-reply", timeout=5000)
    print("reply visible", flush=True)
    meta = page.locator(".qa-post:has-text('" + TITLE + "') .qa-meta").first.inner_text()
    print("meta:", " ".join(meta.split()), flush=True)

    # 未登录用户也可浏览该帖
    page.locator('a[data-view="profile"]').click()
    page.wait_for_selector("#btnLogout", timeout=5000)
    page.locator("#btnLogout").click()
    page.wait_for_selector("#authForm")
    page.locator('a[data-view="qa"]').click()
    page.wait_for_selector(".qa-post:has-text('" + TITLE + "')")
    print("anon browse posts still ok", flush=True)

    print("console errors:", len(errors), flush=True)
    for e in errors:
        print("  ERR:", e, flush=True)
    b.close()
print("--- M9 DONE ---", flush=True)
