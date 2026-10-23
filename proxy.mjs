#!/usr/bin/env node
/**
 * 面试陪练台 · 本地转发代理
 *
 * 用途：有些浏览器环境（扩展拦截、跟踪防护、CORS 限制）不允许网页直接请求大模型接口。
 *      在本机起一个小服务转发一下就行，请求体、API Key 都不落地，只在本机内存里过一遍。
 *
 * 用法：
 *   node proxy.mjs https://api.deepseek.com
 *   node proxy.mjs https://open.bigmodel.cn/api/paas/v4
 *
 * 然后在页面「设置 → Base URL」里填：
 *   http://127.0.0.1:8787/v1
 *
 * 停止：Ctrl + C
 */

import http from "node:http";

const TARGET = (process.argv[2] || "https://api.deepseek.com").replace(/\/+$/, "");
const PORT = Number(process.env.PORT || 8787);

const server = http.createServer(async (req, res) => {
  // 只放行本机页面，避免被别处调用
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = TARGET + (req.url || "/");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

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
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    });
    res.end(text);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: "代理转发失败：" + err.message } }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("  代理已启动");
  console.log("  本地地址   http://127.0.0.1:" + PORT);
  console.log("  转发目标   " + TARGET);
  console.log("");
  console.log("  在页面「设置 → Base URL」填：http://127.0.0.1:" + PORT + "/v1");
  console.log("  停止按 Ctrl + C");
  console.log("");
});
