# -*- coding: utf-8 -*-
"""闯关模块单独 probe：点选后立刻打印 DOM 状态与页面错误"""
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)
    page = b.new_page()
    page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
    page.goto("file:///D:/work/劳动法治教育/index.html", wait_until="load")
    page.locator('a[data-view="quiz"]').click()
    page.wait_for_selector("#view-quiz.active")
    print("Q1:", page.locator("#quizBox h3").first.text_content())
    print("opts:", page.locator("#quizOpts .quiz-opt").count())
    page.locator('#quizOpts .quiz-opt[data-i="0"]').click()
    page.wait_for_timeout(300)
    print("explain html:", page.locator("#quizExplain").inner_html()[:200])
    print("next visible:", page.locator("#btnQuizNext").is_visible())
    ans = page.evaluate("LJ.QUIZ[0].ans")
    print("expected ans index:", ans)
    print("ERRORS:", len(errors))
    for e in errors:
        print("  ", e)
    b.close()