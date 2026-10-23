#!/usr/bin/env node
/**
 * 面试陪练台 · 本地转发代理
 *
 * 用途：浏览器因为扩展拦截、跟踪防护、CSP 或网络策略，不允许网页直接请求大模型接口时，
 *      在本机起一个小服务转一下。请求体和 API Key 都不落盘，只在内存里过一遍。
 *
 * 用法：
 *   node proxy.mjs                                  # 默认转发 DeepSeek
 *   node proxy.mjs https://open.bigmodel.cn/api/paas/v4
 *   PORT=9000 node proxy.mjs https://api.deepseek.com/v1
 *
 * 然后在页面「设置 → Base URL」里填：
 *   http://127.0.0.1:8787/v1          （目标是 DeepSeek 时）
 *   http://127.0.0.1:8787/v4          （目标是智谱时）
 *
 * 健康检查：浏览器打开 http://127.0.0.1:8787/health
 * 停止：Ctrl + C
 */

import http from "node:http";

let TARGET = (process.argv[2] || "https://api.deepseek.com").trim().replace(/\/+$/, "");
if (!/^https?:\/\//.test(TARGET)) TARGET = "https://" + TARGET;
const PORT = Number(process.env.PORT || 8787);

// 目标里如果已经带了 /v1，而页面也发了 /v1/...，就去掉重复的一段
function joinPath(base, path) {
  const b = base.replace(/\/+$/, "");
  let p = path || "/";
  const m = b.match(/\/(v\d+)$/);
  if (m) {
    const seg = "/" + m[1];
    if (p === seg) p = "/";
    else if (p.startsWith(seg + "/")) p = p.slice(seg.length);
  }
  return b + (p.startsWith("/") ? p : "/" + p);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, target: TARGET }));
  }

  const url = joinPath(TARGET, req.url);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const t0 = Date.now();
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
    });

    const text = await upstream.text();
    console.log(`  ${upstream.status}  ${req.method} ${req.url}  ${Date.now() - t0}ms`);
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    });
    res.end(text);
  } catch (err) {
    console.log(`  502  ${req.method} ${req.url}  ${err.message}`);
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: { message: "代理转发失败：" + err.message + "（目标 " + url + "）" },
      })
    );
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n  端口 ${PORT} 已被占用。换一个：PORT=8788 node proxy.mjs\n`);
  } else {
    console.error("\n  启动失败：" + e.message + "\n");
  }
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("  代理已启动（只监听本机，外部访问不到）");
  console.log("  本地地址   http://127.0.0.1:" + PORT);
  console.log("  转发目标   " + TARGET);
  console.log("  健康检查   http://127.0.0.1:" + PORT + "/health");
  console.log("");
  console.log("  在页面「设置 → Base URL」填：http://127.0.0.1:" + PORT + "/v1");
  console.log("  停止按 Ctrl + C");
  console.log("");
});
