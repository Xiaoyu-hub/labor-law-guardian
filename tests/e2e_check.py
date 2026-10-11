# -*- coding: utf-8 -*-
"""《劳动法治护航》端到端验证：file:// 零网络打开 + 五大模块逐项走查 + 截图"""
import os
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = r"D:/work/劳动法治教育"
SHOTS = os.path.join(BASE, "shots")
os.makedirs(SHOTS, exist_ok=True)

errors, warnings = [], []

def log(msg):
    print(msg, flush=True)

def shot(page, name):
    path = os.path.join(SHOTS, name)
    page.screenshot(path=path, full_page=True)
    log("  shot: %s" % path)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)
    page = b.new_page(viewport={"width": 1440, "height": 960})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))

    page.goto("file:///" + BASE + "/index.html", wait_until="load")
    log("TITLE: %s" % page.title())
    log("URL: %s" % page.url)

    # ---- 首页 ----
    assert page.locator(".hero h1").count() == 1, "hero missing"
    # stats: 40+ rules etc.
    home_metrics = page.locator("#homeChart .metric").count()
    log("home metric cards: %d" % home_metrics)
    shot(page, "01_home.png")

    # ---- 合同体检 ----
    page.locator('a[data-view="check"]').click()
    page.wait_for_selector("#view-check.active")
    page.locator("#btnSample").click()
    n_chars = page.locator("#contractInput").input_value()
    log("sample contract chars: %d" % len(n_chars))
    page.locator("#btnCheck").click()
    page.wait_for_selector("#findingList .finding")
    findings = page.locator("#findingList .finding").count()
    marks = page.locator(".contract-box mark").count()
    gauge = page.locator(".contract-box + *")  # noop
    score_txt = page.locator("#checkResult svg text").first.text_content()
    log("findings: %d, marks: %d, gauge-first-text: %s" % (findings, marks, score_txt))
    shot(page, "02_check.png")

    # ---- 权益计算（演示数据）----
    page.locator('a[data-view="calc"]').click()
    page.wait_for_selector("#view-calc.active")
    page.locator("#btnCalcDemo").click()
    page.wait_for_selector("#calcResult .card")
    metrics = page.locator("#calcResult .metric").count()
    calc_text = page.locator("#calcResult").inner_text()
    log("calc metrics: %d" % metrics)
    # 抽查关键数值
    for expect in ["48,000", "5,425.29", "40,000", "5,517.24"]:
        found = expect in calc_text
        log("calc contains %s: %s" % (expect, found))
    shot(page, "03_calc.png")

    # ---- 维权导航 ----
    page.locator('a[data-view="roadmap"]').click()
    page.wait_for_selector("#view-roadmap.active")
    page.locator('#roadmapTypes button[data-rid="unpay"]').click()
    page.wait_for_selector("#roadmapResult .timeline")
    tl = page.locator("#roadmapResult .tl-item").count()
    log("roadmap(unpay) timeline items: %d" % tl)
    shot(page, "04_roadmap.png")

    # ---- 情景闯关：第1题故意答错，其余全对，走完 12 题 ----
    page.locator('a[data-view="quiz"]').click()
    page.wait_for_selector("#view-quiz.active")
    for i in range(12):
        try:
            if i == 0:
                page.locator('#quizOpts .quiz-opt[data-i="0"]').click()
            else:
                ans = page.evaluate("LJ.QUIZ[%d].ans" % i)
                page.locator('#quizOpts .quiz-opt[data-i="%d"]' % ans).click()
            page.wait_for_selector("#quizExplain .explain", timeout=5000)
            page.locator("#btnQuizNext").click()
            page.wait_for_timeout(80)
        except Exception as ex:
            log("quiz FAIL at Q%d: %s" % (i + 1, ex))
            log("  box html: " + page.locator("#quizBox").inner_html()[:300])
            raise
    page.wait_for_selector("#btnQuizAgain")
    final_text = page.locator("#quizBox").inner_text()
    log("quiz final: %s" % " ".join(final_text.split())[:100])
    shot(page, "05_quiz.png")

    # ---- 法条速查 ----
    page.locator('a[data-view="law"]').click()
    page.wait_for_selector("#view-law.active")
    page.locator("#lawSearch").fill("试用期")
    page.wait_for_timeout(120)
    law_items = page.locator("#lawResult .law-item").count()
    log("law search '试用期' items: %d" % law_items)
    shot(page, "06_law.png")

    b.close()

log("CONSOLE ERRORS: %d" % len(errors))
for e in errors:
    log("  ERR: " + e)
log("--- DONE ---")
