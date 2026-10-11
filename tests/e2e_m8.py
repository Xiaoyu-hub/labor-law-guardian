# -*- coding: utf-8 -*-
"""M8 前端接通 e2e：体检/计算自动保存 → 档案页统计/打卡/排行榜/历史 → 删除 → 重放
   前置：后端 127.0.0.1:5000（python -m server.server）
"""
import random
import string
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "http://127.0.0.1:5000/"
suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
UNAME = "m8user_" + suffix

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)
    page = b.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(400)

    # 注册
    page.locator('a[data-view="profile"]').click()
    page.wait_for_selector("#authForm")
    page.locator('[data-auth-tab="register"]').click()
    page.locator("#auNick").fill("M8测试员")
    page.locator("#auUser").fill(UNAME)
    page.locator("#auPass").fill("demo123456")
    page.locator("#authForm button[type=submit]").click()
    page.wait_for_selector("#btnLogout", timeout=5000)

    # 体检一次（示例合同）
    page.locator('a[data-view="check"]').click()
    page.locator("#btnSample").click()
    page.locator("#btnCheck").click()
    page.wait_for_selector("#findingList .finding")
    n_find = page.locator("#findingList .finding").count()
    print("check findings:", n_find, flush=True)

    # 计算一次（演示数据）
    page.locator('a[data-view="calc"]').click()
    page.locator("#btnCalcDemo").click()
    page.wait_for_selector("#calcResult .card")
    print("calc ok", flush=True)

    # 闯关一轮（点第一个选项 ×N）
    page.locator('a[data-view="quiz"]').click()
    total_q = page.evaluate("LJ.QUIZ.length")
    for _ in range(total_q):
        page.wait_for_selector("#quizOpts .quiz-opt")
        page.locator("#quizOpts .quiz-opt").first.click()
        page.wait_for_selector("#btnQuizNext")
        page.locator("#btnQuizNext").click()
    page.wait_for_selector("#btnQuizAgain")
    page.wait_for_selector("#quizBest", timeout=5000)
    print("quiz done, best line:", page.locator("#quizBest").inner_text(), flush=True)

    # 档案页：统计卡 + 打卡 + 排行榜 + 历史
    page.locator('a[data-view="profile"]').click()
    page.wait_for_selector("#btnCheckin", timeout=5000)
    stats = page.locator("#profileBox .metric").all_inner_texts()
    stats_flat = " | ".join(" ".join(s.split()) for s in stats)
    print("stats:", stats_flat, flush=True)
    checks_before = page.locator("[data-del-check]").count()
    calcs_before = page.locator("[data-del-calc]").count()
    print("history rows: checks=%d calcs=%d" % (checks_before, calcs_before), flush=True)
    board = page.locator("#profileBox table.data").count()
    print("leaderboard table present:", board == 1, flush=True)

    # 打卡
    page.locator("#btnCheckin:not([disabled])").click()
    page.wait_for_selector("#checkinMsg", timeout=5000)
    print("checkin msg:", page.locator("#checkinMsg").inner_text(), flush=True)
    page.wait_for_timeout(500)  # loadProfileData 刷新
    print("streak metric now:", " ".join(page.locator("#profileBox .metric").first.inner_text().split()), flush=True)

    # 删除一条体检记录 → 数量减 1
    if checks_before:
        page.locator("[data-del-check]").first.click()
        page.wait_for_timeout(800)
        checks_after = page.locator("[data-del-check]").count()
        print("after delete: checks %d -> %d" % (checks_before, checks_after), flush=True)
        assert checks_after == checks_before - 1, "删除体检记录后数量未减一"

    # 重放计算记录 → 回到 calc 视图并出结果
    if calcs_before:
        page.locator('a[data-view="profile"]').click()
        page.wait_for_selector("[data-replay-calc]")
        page.locator("[data-replay-calc]").first.click()
        page.wait_for_selector("#calcResult .card", timeout=5000)
        print("replay calc ok", flush=True)

    print("console errors:", len(errors), flush=True)
    for e in errors:
        print("  ERR:", e, flush=True)
    page.screenshot(path="shots/08_profile_stats.png", full_page=False)
    b.close()
print("--- M8 DONE ---", flush=True)
