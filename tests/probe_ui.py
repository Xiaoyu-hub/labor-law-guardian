# -*- coding: utf-8 -*-
"""S3 UI 目检探针：emoji 残留扫描 + 设计令牌 computed style + 关键数值契约
   前置：后端 127.0.0.1:5000
"""
import re
import sys
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "http://127.0.0.1:5000"

EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F]"
)

# 设计令牌期望值（与 style.css 一致）
TOKENS = {
    "body bg": "rgb(11, 15, 20)",
    "panel border-radius": "10px",
    "nav underline": "rgb(212, 168, 75)",
}

fails = []


def check(name, cond, detail=""):
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {name}" + (f"  ({detail})" if detail else ""), flush=True)
    if not cond:
        fails.append(name)


def scan_emoji(page, label):
    texts = page.locator("body").inner_text()
    hits = sorted(set(EMOJI_RE.findall(texts)))
    check(f"emoji-free: {label}", not hits, "found " + ",".join(hits) if hits else "")
    return hits


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EDGE, headless=True)
        pg = b.new_page(viewport={"width": 1280, "height": 900})
        pg.on("console", lambda m: print("CONSOLE:", m.text, flush=True)
              if m.type == "error" else None)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        pg.goto(BASE, wait_until="networkidle")
        scan_emoji(pg, "home")

        # 设计令牌
        bg = pg.evaluate("getComputedStyle(document.body).backgroundColor")
        check("token bg", bg == TOKENS["body bg"], bg)
        grad = pg.evaluate(
            "getComputedStyle(document.querySelector('.card')).backgroundImage")
        check("card no gradient", grad in ("none", ""), grad)
        radius = pg.evaluate(
            "getComputedStyle(document.querySelector('.card')).borderRadius")
        check("card radius", radius == TOKENS["panel border-radius"], radius)
        navline = pg.evaluate(
            "getComputedStyle(document.querySelector('nav a.active')).borderBottomColor"
            if pg.locator("nav a.active").count()
            else "getComputedStyle(document.querySelector('nav a')).borderBottomColor")
        check("nav gold underline", navline == TOKENS["nav underline"], navline)
        ctitle = pg.evaluate(
            "getComputedStyle(document.querySelector('.card-title'), '::before').backgroundColor")
        check("card-title gold bar", ctitle == "rgb(212, 168, 75)", ctitle)

        # 各视图截图
        views = ["home", "check", "calc", "roadmap", "quiz", "law", "profile"]
        for v in views:
            pg.locator(f'a[data-view="{v}"]').first.click()
            pg.wait_for_timeout(450)
            pg.screenshot(path=f"shots/ui_{v}.png")
            scan_emoji(pg, v)

        # 契约：calc 数值（演示数据）
        pg.locator('a[data-view="calc"]').first.click()
        pg.wait_for_timeout(300)
        pg.locator("#btnCalcDemo").click()
        pg.wait_for_selector("#calcResult .card", timeout=5000)
        pg.screenshot(path="shots/ui_calc_result.png")
        txt = pg.locator("#calcResult").inner_text()
        for expected in ["48,000", "5,425.29", "40,000", "5,517.24"]:
            check(f"calc contract {expected}", expected in txt)
        metrics = pg.locator("#calcResult .metric").count()
        check("calc metric count>=4", metrics >= 4, str(metrics))
        check("calc contract total", "98,942.53" in txt)

        # 契约：roadmap 差异度关键步骤
        pg.locator('a[data-view="roadmap"]').first.click()
        pg.wait_for_timeout(300)
        pg.locator("[data-rid]").first.click()
        pg.wait_for_timeout(400)
        tl = pg.locator("#roadmapResult .tl-item").count()
        check("roadmap tl items", tl >= 4, str(tl))

        # profile 未登录 = 登录表单
        pg.locator('a[data-view="profile"]').first.click()
        pg.wait_for_timeout(400)
        check("profile auth form", pg.locator("#authForm").count() == 1)
        pg.screenshot(path="shots/ui_profile_login.png")

        scan_emoji(pg, "profile-login")
        check("page errors", len(errs) == 0, "; ".join(errs))
        print("--- UI PROBE DONE: %d FAIL ---" % len(fails), flush=True)
        b.close()
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()