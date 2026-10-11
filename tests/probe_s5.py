# -*- coding: utf-8 -*-
"""S5 探针：file:// 双模式下 S4/S5 内容全覆盖 + 导出打印版报告
   纯前端验证（新增规则/新增计算/新题量/导出报告），无需后端
"""
import sys
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "file:///D:/work/劳动法治教育/index.html"
fails = []


def check(name, cond, detail=""):
    print("[%s] %s%s" % ("PASS" if cond else "FAIL", name, "  (" + detail + ")" if detail else ""), flush=True)
    if not cond:
        fails.append(name)


CONTRACT = """甲方：某科技有限公司。劳动合同期限三年。
双方约定：乙方工资面议，具体数额另行协商。
乙方同意甲方根据经营需要在全国范围内调动工作地点，并应无条件服从。
公司实行末位淘汰制度，连续两个月业绩排名末位的员工予以辞退。
合同期内若乙方怀孕，甲方有权安排其夜班工作。
"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    cns = []
    pg.on("console", lambda m: cns.append(m.text) if m.type == "error" else None)
    pg.goto(BASE, wait_until="load")

    # ---- 总量 ----
    check("rules 47", pg.evaluate("LJ.RULES.length") == 47, str(pg.evaluate("LJ.RULES.length")))
    check("laws 53", pg.evaluate("LJ.LAWS.length") == 53, str(pg.evaluate("LJ.LAWS.length")))
    check("quiz 14", pg.evaluate("LJ.QUIZ.length") == 14, str(pg.evaluate("LJ.QUIZ.length")))

    # ---- S4 新规则 file:// 命中 ----
    pg.locator('a[data-view="check"]').first.click()
    pg.wait_for_timeout(300)
    pg.fill("#contractInput", CONTRACT)
    pg.locator("#btnCheck").click()
    pg.wait_for_selector("#findingList .finding", timeout=5000)
    txt = pg.locator("#findingList").inner_text()
    for kw, name in [("末位淘汰", "eliminate_last"), ("面议", "wage_negotiable"),
                     ("调动", "transfer_clause"), ("夜班", "preg_night")]:
        check("file-mode check hits " + name, kw in txt, kw)
    pg.screenshot(path="shots/ui_check_s4.png", full_page=False)

    # ---- S5 导出报告 ----
    with ctx.expect_page() as pop:
        pg.locator("#btnExportReport").click()
    rp = pop.value
    rp.wait_for_load_state("domcontentloaded")
    rp.wait_for_timeout(400)
    rbody = rp.locator("body").inner_text()
    for kw in ["合同体检报告", "风险评分", "末位淘汰", "依据法条原文", "仅供学习与自查参考"]:
        check("report contains " + kw, kw in rbody, kw)
    rp.screenshot(path="shots/09_report_export.png", full_page=False)
    rp.close()

    # ---- S4 新计算 file:// ----
    pg.locator('a[data-view="calc"]').first.click()
    pg.wait_for_timeout(300)
    pg.fill("#calcMonthly", "8000")
    pg.fill("#injMonths", "6")
    pg.fill("#matAvg", "9000")
    pg.fill("#matDays", "98")
    pg.locator("#btnCalc").click()
    pg.wait_for_selector("#calcResult .card", timeout=5000)
    ct = pg.locator("#calcResult").inner_text()
    check("file-mode suspension 48000", "48,000" in ct)
    check("file-mode maternity 29400", "29,400" in ct)
    pg.screenshot(path="shots/ui_calc_s4.png", full_page=False)

    # ---- file:// 无 console/page 错误 ----
    check("page errors", len(errs) == 0, "; ".join(errs))
    check("console errors", len(cns) == 0, "; ".join(cns[:3]))
    print("--- S5 PROBE DONE: %d FAIL ---" % len(fails), flush=True)
    b.close()
sys.exit(1 if fails else 0)
