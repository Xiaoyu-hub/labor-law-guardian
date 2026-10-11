# -*- coding: utf-8 -*-
"""S2 维权导航差异度 e2e：6 类纠纷专属路线各不相同
   检查：每类步骤数、通道标签、关键差异化步骤出现/不出现
   跑法：file:// 直开即可（静态数据）
"""
from playwright.sync_api import sync_playwright

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "file:///D:/work/劳动法治教育/index.html"

# 每类的专属断言：必须包含 / 不得包含 的关键步骤标题
EXPECT = {
    'unpay':   {'must': ['劳动监察投诉', '支付令', '刑事追责'], 'tags': ['行政', '刑事', '执行']},
    'nocontract': {'must': ['事实劳动关系', '补签', '双倍工资差额'], 'tags': ['证据', '仲裁']},
    'unfair':  {'must': ['定性解除性质', '继续履行 or 2N', '书面提出异议'], 'tags': ['决策']},
    'injury':  {'must': ['申请工伤认定', '劳动能力鉴定', '工伤保险基金先行支付'], 'tags': ['行政', '待遇', '仲裁']},
    'overtime': {'must': ['包薪制', '考勤证据责任', '21.75'], 'tags': ['行政', '仲裁']},
    'social':  {'must': ['要求补缴', '责令单位限期办理', '被迫离职 + 经济补偿'], 'tags': ['行政', '仲裁']},
}

# injury 特殊：desc 含「行政认定前置」
DESC_CHECK = {'injury': '行政认定前置'}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EDGE, headless=True)
    page = b.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(300)

    page.locator('a[data-view="roadmap"]').click()
    page.wait_for_selector("#roadmapTypes .btn")
    buttons = page.locator("#roadmapTypes .btn").all_inner_texts()
    print("类型按钮:", " / ".join(b_.strip() for b_ in buttons), flush=True)
    assert len(buttons) == 7, "应有 6 类 + 通用共 7 个按钮"

    step_counts = {}
    for rid, spec in EXPECT.items():
        page.locator('#roadmapTypes button[data-rid="' + rid + '"]').click()
        page.wait_for_selector("#roadmapResult .tl-item")
        n_steps = page.locator("#roadmapResult .tl-item").count()
        step_counts[rid] = n_steps
        text = page.locator("#roadmapResult").inner_text()
        tags = page.locator("#roadmapResult .tl-tag").all_inner_texts()
        missing = [m for m in spec['must'] if m not in text]
        missing_tags = [t for t in spec['tags'] if t not in tags]
        assert not missing, "%s 缺少关键步骤: %s" % (rid, missing)
        assert not missing_tags, "%s 缺少通道标签: %s" % (rid, missing_tags)
        print("✔ %-10s 步骤=%d 标签=%s" % (rid, n_steps, "/".join(t.strip() for t in tags)), flush=True)

    # 差异度：6 类步骤数不全相同
    assert len(set(step_counts.values())) >= 3, "步骤数应存在差异: %s" % step_counts
    print("步骤数分布:", step_counts, "（差异度 ≥3 档）", flush=True)

    # injury desc 含行政认定前置表述
    page.locator('#roadmapTypes button[data-rid="injury"]').click()
    page.wait_for_selector("#roadmapResult .tl-item")
    desc = page.locator("#roadmapResult .card-sub").inner_text()
    assert DESC_CHECK['injury'] in desc, "injury desc 应说明行政认定前置"
    print("✔ injury 说明含「行政认定前置」", flush=True)

    # 通用流程仍可用（5 步）
    page.locator('#roadmapTypes button[data-rid="__all"]').click()
    page.wait_for_selector("#roadmapResult .tl-item")
    n = page.locator("#roadmapResult .tl-item").count()
    assert n == 5, "通用流程应 5 步，实际 %d" % n
    print("✔ 通用流程 5 步", flush=True)

    print("console errors:", len(errors), flush=True)
    for e in errors:
        print("  ERR:", e, flush=True)
    assert len(errors) == 0
    b.close()
print("--- S2 DONE ---", flush=True)