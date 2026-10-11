# -*- coding: utf-8 -*-
"""布局与渲染健全性探针：横向溢出 / 关键元素可见性 / SVG 渲染 / 中文渲染抽查"""
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)
    page = b.new_page(viewport={"width": 1440, "height": 960})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
    page.goto("file:///D:/work/劳动法治教育/index.html", wait_until="load")

    def probe_view(name, nav_selector, wait_selector, checks):
        page.locator(nav_selector).click()
        page.wait_for_selector(wait_selector)
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        print("[%s] horizontal overflow px: %d" % (name, overflow), flush=True)
        for label, expr in checks:
            v = page.evaluate(expr)
            print("   %s: %s" % (label, v), flush=True)
        return overflow

    probe_view("home", 'a[data-view="home"]', "#view-home.active", [
        ("svgs", "document.querySelectorAll('#view-home svg').length"),
        ("hero h1 text len", "document.querySelector('.hero h1').textContent.length"),
    ])

    # check view again (need sample+run)
    page.locator('a[data-view="check"]').click()
    page.wait_for_selector("#view-check.active")
    page.locator("#btnSample").click()
    page.locator("#btnCheck").click()
    page.wait_for_selector("#findingList .finding")
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    print("[check] horizontal overflow px: %d" % overflow, flush=True)
    print("   svgs: %d, marks: %d, findings: %d" % (
        page.evaluate("document.querySelectorAll('#checkResult svg').length"),
        page.evaluate("document.querySelectorAll('.contract-box mark').length"),
        page.evaluate("document.querySelectorAll('#findingList .finding').length")), flush=True)
    # 中文渲染抽查：canvas 无法读，改为读取文字宽度与字体族
    print("   body font-family:", page.evaluate("getComputedStyle(document.body).fontFamily"), flush=True)

    probe_view("calc", 'a[data-view="calc"]', "#view-calc.active", [
        ("svgs", "0"),
    ])
    page.locator("#btnCalcDemo").click()
    page.wait_for_selector("#calcResult svg")
    print("[calc] bars svg count: %d" % page.evaluate("document.querySelectorAll('#calcResult svg').length"), flush=True)

    probe_view("roadmap", 'a[data-view="roadmap"]', "#view-roadmap.active", [
        ("type buttons", "document.querySelectorAll('#roadmapTypes button').length"),
    ])

    probe_view("quiz", 'a[data-view="quiz"]', "#view-quiz.active", [
        ("progress bar width %", "document.querySelector('#quizProgress i').style.width"),
    ])

    probe_view("law", 'a[data-view="law"]', "#view-law.active", [
        ("law cards", "document.querySelectorAll('#lawResult .card').length"),
        ("quick chips", "document.querySelectorAll('#lawQuick button').length"),
        ("total laws", "LJ.LAWS.length"),
        ("total rules", "LJ.RULES.length"),
    ])

    print("PAGE ERRORS: %d" % len(errors), flush=True)
    for e in errors:
        print("  ERR:", e, flush=True)
    b.close()