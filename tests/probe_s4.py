# -*- coding: utf-8 -*-
"""S4 内容深化探针：4 条新体检规则命中 + 停工留薪期/生育津贴计算 + 题目/法条/规则总量"""
import sys
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
fails = []


def check(name, cond, detail=""):
    print("[%s] %s%s" % ("PASS" if cond else "FAIL", name, "  (" + detail + ")" if detail else ""), flush=True)
    if not cond:
        fails.append(name)


CONTRACT = """甲方：某科技有限公司。劳动合同期限三年。
乙方试用期约定为三个月，试用期工资按转正工资的80%支付。
双方约定：乙方工资面议，具体数额另行协商。
乙方同意甲方根据经营需要在全国范围内调动工作地点，并应无条件服从。
公司实行末位淘汰制度，连续两个月业绩排名末位的员工予以辞退。
合同期内若乙方怀孕，甲方有权安排其夜班工作。
"""
# 注意：试用期3个月+3年期=合法（不触发试用期规则）；80% 合法；上列 4 条新规则应命中

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:5000", wait_until="networkidle")

    # ---- 体检：4 条新规则 ----
    pg.locator('a[data-view="check"]').first.click()
    pg.wait_for_timeout(300)
    pg.fill("#contractInput", CONTRACT)
    pg.locator("#btnCheck").click()
    pg.wait_for_selector("#findingList .finding", timeout=5000)
    txt = pg.locator("#findingList").inner_text()
    for kw, name in [("末位淘汰", "eliminate_last"), ("面议", "wage_negotiable"),
                     ("调动", "transfer_clause"), ("夜班", "preg_night")]:
        check("check hits " + name, kw in txt, kw)
    n = pg.locator("#findingList .finding").count()
    check("findings >= 4", n >= 4, str(n))

    # ---- 计算：停工留薪期 + 生育津贴 ----
    pg.locator('a[data-view="calc"]').first.click()
    pg.wait_for_timeout(300)
    pg.locator("#btnCalcDemo").click()
    pg.fill("#injMonths", "6")
    pg.fill("#matAvg", "9000")
    pg.fill("#matDays", "98")
    pg.locator("#btnCalc").click()
    pg.wait_for_selector("#calcResult .card", timeout=5000)
    ct = pg.locator("#calcResult").inner_text()
    check("suspension 48000", "48,000" in ct)
    check("maternity 29400", "29,400" in ct)
    check("maternity formula shown", "9,000 ÷ 30" in ct.replace("，", "") or "9000 ÷ 30" in ct)

    # ---- 总量 ----
    check("rules 47", pg.evaluate("LJ.RULES.length") == 47, str(pg.evaluate("LJ.RULES.length")))
    check("laws 53", pg.evaluate("LJ.LAWS.length") == 53, str(pg.evaluate("LJ.LAWS.length")))
    check("quiz 14", pg.evaluate("LJ.QUIZ.length") == 14, str(pg.evaluate("LJ.QUIZ.length")))
    check("page errors", len(errs) == 0, "; ".join(errs))
    print("--- S4 PROBE DONE: %d FAIL ---" % len(fails), flush=True)
    b.close()
sys.exit(1 if fails else 0)