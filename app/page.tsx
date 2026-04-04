"use client";
import { useState, useEffect, useRef } from "react";

const R = 28;
const SQ3 = Math.sqrt(3);
const SVG_W = 320;
const SVG_H = 310;
const OX = SVG_W / 2;
const OY = SVG_H / 2 + 2;

function axialToPixel(q, r) {
  const x = OX + SQ3 * R * q + (SQ3 / 2) * R * r;
  const y = OY + 1.5 * R * r;
  return [x, y];
}

function hexCorners(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

const TILE_DEFS = [
  {q:0,r:-2},{q:1,r:-2},{q:2,r:-2},
  {q:-1,r:-1},{q:0,r:-1},{q:1,r:-1},{q:2,r:-1},
  {q:-2,r:0},{q:-1,r:0},{q:0,r:0},{q:1,r:0},{q:2,r:0},
  {q:-2,r:1},{q:-1,r:1},{q:0,r:1},{q:1,r:1},
  {q:-2,r:2},{q:-1,r:2},{q:0,r:2},
];

const BASE_RESOURCES = [
  "mountain","pasture","forest",
  "field","hill","pasture","hill",
  "field","forest","desert","forest","mountain",
  "forest","mountain","field","pasture",
  "hill","field","pasture"
];

const EDGE_VERTS = [[5,0],[0,1],[1,2],[2,3],[3,4],[4,5]];

const PORT_DEFS = [
  {q:0,r:-2,dir:0,type:"t31"},
  {q:2,r:-2,dir:1,type:"t31"},
  {q:2,r:0,dir:2,type:"mountain"},
  {q:1,r:1,dir:2,type:"t31"},
  {q:0,r:2,dir:3,type:"pasture"},
  {q:-2,r:2,dir:4,type:"hill"},
  {q:-2,r:1,dir:4,type:"t31"},
  {q:-2,r:0,dir:5,type:"field"},
  {q:-1,r:-1,dir:5,type:"forest"},
];

const PORT_COLORS = {t31:"#b8860b",forest:"#1a5c10",pasture:"#3a8a10",field:"#a07800",hill:"#8b2500",mountain:"#505050"};
const PORT_LABEL = {t31:"3:1",forest:"木2:1",pasture:"羊2:1",field:"麦2:1",hill:"土2:1",mountain:"鉄2:1"};
const RES_LABEL = {forest:"森",pasture:"牧草",field:"畑",hill:"丘",mountain:"山",desert:"砂漠"};
const PIPS = {2:1,3:2,4:3,5:4,6:5,8:5,9:4,10:3,11:2,12:1};
const ALL_NUMS = [2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12];
const P_COLORS = ["red","blue","orange","white"];
const P_STYLE = {red:"#e53e3e",blue:"#3182ce",orange:"#dd6b20",white:"#cccccc"};
const P_LABEL = {red:"赤",blue:"青",orange:"橙",white:"白"};
const SNAKE = [0,1,2,3,3,2,1,0];
const DICE = ["one","two","three","four","five","six"];
const DICE_EMOJI = ["⚀","⚁","⚂","⚃","⚄","⚅"];

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = b[i]; b[i] = b[j]; b[j] = t;
  }
  return b;
}

function buildBoard() {
  const tiles = TILE_DEFS.map((d, i) => {
    const [cx, cy] = axialToPixel(d.q, d.r);
    return { id: i, q: d.q, r: d.r, cx, cy, res: BASE_RESOURCES[i] };
  });
  const vmap = new Map();
  const tvids = [];
  tiles.forEach((t, ti) => {
    const corners = hexCorners(t.cx, t.cy, R);
    const ids = corners.map(([vx, vy]) => {
      const key = Math.round(vx) + "_" + Math.round(vy);
      if (!vmap.has(key)) vmap.set(key, { id: vmap.size, x: Math.round(vx), y: Math.round(vy), tiles: [] });
      const v = vmap.get(key);
      if (!v.tiles.includes(ti)) v.tiles.push(ti);
      return v.id;
    });
    tvids.push(ids);
  });
  const verts = [...vmap.values()];
  const emap = new Map();
  tvids.forEach(ids => {
    for (let i = 0; i < 6; i++) {
      const a = ids[i], b = ids[(i + 1) % 6];
      const k = Math.min(a, b) + "-" + Math.max(a, b);
      if (!emap.has(k)) emap.set(k, { id: emap.size, v1: a, v2: b });
    }
  });
  const edges = [...emap.values()];
  const adjV = new Map();
  const adjE = new Map();
  edges.forEach(e => {
    [e.v1, e.v2].forEach(v => {
      if (!adjV.has(v)) adjV.set(v, []);
      if (!adjE.has(v)) adjE.set(v, []);
    });
    adjV.get(e.v1).push(e.v2);
    adjV.get(e.v2).push(e.v1);
    adjE.get(e.v1).push({ eid: e.id, nxt: e.v2 });
    adjE.get(e.v2).push({ eid: e.id, nxt: e.v1 });
  });
  const tileByQR = new Map(tiles.map(t => [t.q + "," + t.r, t]));
  const ports = PORT_DEFS.map(p => {
    const t = tileByQR.get(p.q + "," + p.r);
    if (!t) return null;
    const [i1, i2] = EDGE_VERTS[p.dir];
    const vids = [tvids[t.id][i1], tvids[t.id][i2]];
    const v1 = verts[vids[0]], v2 = verts[vids[1]];
    const mx = (v1.x + v2.x) / 2, my = (v1.y + v2.y) / 2;
    const dx = mx - OX, dy = my - OY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { type: p.type, vids, v1, v2, px: mx + dx / len * 18, py: my + dy / len * 18 };
  }).filter(Boolean);
  return { tiles, verts, edges, ports, adjV, adjE };
}

const B = buildBoard();
const PORT_VSET = new Set(B.ports.flatMap(p => p.vids));

function getPort(vid) { return B.ports.find(p => p.vids.includes(vid)) || null; }
function vScore(vid, nm) {
  return B.verts[vid].tiles.reduce((s, ti) => { const n = nm[ti]; return s + (n ? (PIPS[n] || 0) : 0); }, 0);
}
function vRes(vid) { return B.verts[vid].tiles.map(ti => B.tiles[ti].res).filter(r => r !== "desert"); }
function legal(vid, sett) {
  if (sett[vid]) return false;
  return !(B.adjV.get(vid) || []).some(n => sett[n]);
}
function aiBest(sett, nm) {
  const existing = Object.keys(sett).flatMap(v => vRes(parseInt(v)));
  const scored = B.verts.map((_, vid) => {
    if (!legal(vid, sett)) return { vid, s: -1 };
    const pip = vScore(vid, nm);
    const div = [...new Set(vRes(vid))].filter(r => !existing.includes(r)).length;
    const port = PORT_VSET.has(vid) ? 1.5 : 0;
    return { vid, s: pip + div * 0.8 + port };
  }).filter(x => x.s >= 0).sort((a, b) => b.s - a.s);
  const top = scored.slice(0, Math.min(5, scored.length));
  if (!top.length) return null;
  return top[Math.floor(Math.random() * top.length)];
}
function aiRoad(vid, roads) {
  const opts = (B.adjE.get(vid) || []).filter(x => !roads[x.eid]);
  return opts.length ? opts[Math.floor(Math.random() * opts.length)].eid : null;
}
function portDist(vid, pvids) {
  const seen = new Set([vid]);
  let front = [vid];
  for (let d = 0; d <= 5; d++) {
    if (pvids.some(pv => front.includes(pv))) return d;
    const next = [];
    front.forEach(fv => { (B.adjV.get(fv) || []).forEach(nv => { if (!seen.has(nv)) { seen.add(nv); next.push(nv); } }); });
    front = next;
  }
  return 99;
}

function genEval(settData, nmData, orderData, myTurnIdx) {
  const myColor = P_COLORS[orderData[myTurnIdx]];
  const myVids = Object.entries(settData).filter(([, s]) => s.color === myColor).map(([vid]) => parseInt(vid));
  if (myVids.length === 0) return "まだ配置がありません。";

  const totalPip = myVids.reduce((s, vid) => s + vScore(vid, nmData), 0);
  const myRes = myVids.flatMap(vid => vRes(vid));
  const uniqueRes = [...new Set(myRes)];

  const portAccess = [];
  myVids.forEach(vid => {
    const pt = getPort(vid);
    if (pt) portAccess.push(PORT_LABEL[pt.type] + "(直接)");
    B.ports.forEach(pp => {
      const d = portDist(vid, pp.vids);
      if (d > 0 && d <= 2) portAccess.push(PORT_LABEL[pp.type] + "まで" + d + "手");
    });
  });

  const resPips = {};
  B.tiles.forEach((t, i) => {
    if (t.res === "desert") return;
    if (!resPips[t.res]) resPips[t.res] = 0;
    resPips[t.res] += PIPS[nmData[i]] || 0;
  });
  const sortedRes = Object.entries(resPips).sort((a, b) => a[1] - b[1]);
  const rareRes = sortedRes.slice(0, 2).map(([r]) => RES_LABEL[r]);
  const richRes = sortedRes.slice(-2).map(([r]) => RES_LABEL[r]);

  const othersRes = Object.entries(settData).filter(([, s]) => s.color !== myColor).flatMap(([vid]) => vRes(parseInt(vid)));
  const uniqueToMe = uniqueRes.filter(r => !othersRes.includes(r));

  const pipScore = Math.min(40, Math.round((totalPip / 22) * 40));
  const divScore = Math.min(20, uniqueRes.length * 4);
  const rareScore = Math.min(20, uniqueToMe.length * 7);
  const portScore = Math.min(20, portAccess.length * 5);
  const score = pipScore + divScore + rareScore + portScore;

  const rank = score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : "D";
  const rankMsg = {S:"Perfect！完璧な配置！",A:"Excellent！素晴らしい配置！",B:"Good！悪くない配置！",C:"Fair。改善の余地あり。",D:"Poor。次は頑張ろう！"};

  const lines = [];
  lines.push("【総合スコア】" + score + "点/100点");
  lines.push("【ランク】" + rank + " - " + rankMsg[rank]);
  lines.push("");
  lines.push("【内訳】");
  lines.push("・確率(pip)スコア: " + pipScore + "/40 (合計" + totalPip + "pip)");
  lines.push("・資源多様性: " + divScore + "/20 (" + uniqueRes.map(r => RES_LABEL[r]).join("・") + ")");
  lines.push("・希少資源保有: " + rareScore + "/20");
  lines.push("・港アクセス: " + portScore + "/20");
  lines.push("");
  lines.push("【盤面分析】");
  lines.push("この盤面で希少な資源: " + rareRes.join("・") + " / 豊富な資源: " + richRes.join("・"));
  lines.push("");
  lines.push("【配置評価】");

  if (totalPip >= 18) lines.push("合計" + totalPip + "pipと高く、資源が安定して入ります。");
  else if (totalPip >= 14) lines.push("合計" + totalPip + "pipと標準的な確率です。");
  else lines.push("合計" + totalPip + "pipとやや低め。資源が入りにくい場面も。");

  if (uniqueToMe.length >= 2) lines.push("他プレイヤーと差別化できた資源(" + uniqueToMe.map(r => RES_LABEL[r]).join("・") + ")があり交渉で有利です。");
  else if (uniqueToMe.length === 1) lines.push("差別化できた資源が" + RES_LABEL[uniqueToMe[0]] + "のみ。交渉力はやや限定的。");
  else lines.push("他プレイヤーと資源が被っています。交渉で優位に立ちにくいです。");

  if (portAccess.length > 0) lines.push("港アクセス: " + portAccess.slice(0, 3).join("・"));
  else lines.push("港へのアクセスが遠め。道を伸ばして港を目指しましょう。");

  lines.push("");
  lines.push("【ゲームプラン】");
  if (uniqueRes.length >= 4 && totalPip >= 16) lines.push("資源バランスが良く都市化戦略が有効。" + (richRes[1] ? RES_LABEL[richRes[1]] + "が豊富なので" : "") + "積極的に発展カードも狙いましょう。");
  else if (portAccess.length > 0) lines.push("港を活かした海外貿易で不足資源を補いましょう。");
  else lines.push(RES_LABEL[rareRes[0]] + "が盤面で希少なので、トレードで優位に立てます。積極的に交渉しましょう。");

  return lines.join("\n");
}

export default function App() {
  const [phase, setPhase] = useState("setup");
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState(null);
  const [myTurnIdx, setMyTurnIdx] = useState(null);
  const [nm, setNm] = useState({});
  const [order, setOrder] = useState([]);
  const [myTurn, setMyTurn] = useState(0);
  const [turnIdx, setTurnIdx] = useState(0);
  const [sett, setSett] = useState({});
  const [roads, setRoads] = useState({});
  const [placing, setPlacing] = useState("s");
  const [waiting, setWaiting] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [tab, setTab] = useState(0);
  const [evalText, setEvalText] = useState("");
  const [chat, setChat] = useState([]);
  const [q, setQ] = useState("");
  const [img, setImg] = useState(null);
  const [imgB64, setImgB64] = useState(null);
  const [photoText, setPhotoText] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [log, setLog] = useState([]);
  const fileRef = useRef();
  const aiTimer = useRef(null);
  const diceTimer = useRef(null);
  const busy = useRef(false);

  function addLog(msg) { setLog(l => [...l.slice(-5), msg]); }

  function startRolling() {
    setRolling(true); setDiceFace(null); setMyTurnIdx(null);
    let count = 0;
    function tick() {
      setDiceFace(DICE_EMOJI[Math.floor(Math.random() * 6)]);
      count++;
      if (count < 20) { diceTimer.current = setTimeout(tick, 80 + count * 10); }
      else {
        const ft = Math.floor(Math.random() * 4);
        setDiceFace(DICE_EMOJI[ft]);
        setMyTurnIdx(ft);
        setRolling(false);
      }
    }
    tick();
  }

  function beginGame(me) {
    if (diceTimer.current) clearTimeout(diceTimer.current);
    const nums = shuffle(ALL_NUMS);
    const newNm = {};
    let ni = 0;
    B.tiles.forEach((t, i) => { if (t.res !== "desert") newNm[i] = nums[ni++]; });
    const newOrder = shuffle([0, 1, 2, 3]);
    setNm(newNm); setOrder(newOrder); setMyTurn(me);
    setSett({}); setRoads({}); setTurnIdx(0);
    setWaiting(false); setAiMsg(""); setEvalText(""); setChat([]);
    setLog(["あなたは" + (me + 1) + "番手（" + P_LABEL[P_COLORS[newOrder[me]]] + "）！"]);
    setPhase("play"); setTab(0);
    busy.current = false;
  }

  useEffect(() => {
    if (phase !== "play") return;
    if (busy.current) return;
    if (turnIdx >= SNAKE.length) { setPhase("done"); addLog("全員の初期配置完了！"); return; }
    const turn = SNAKE[turnIdx];
    if (turn === myTurn) {
      setWaiting(true); setAiMsg("");
      addLog((turnIdx < 4 ? "1" : "2") + "個目: 開拓地を置いてください");
    } else {
      setWaiting(false); busy.current = true;
      const color = P_COLORS[order[turn]];
      const name = P_LABEL[color] + "(" + (turn + 1) + "番手)";
      const placed = Object.keys(sett).length;
      const wait = placed === 0 ? 3000 + Math.random() * 5000 : placed < 4 ? 6000 + Math.random() * 10000 : 10000 + Math.random() * 18000;
      setAiMsg(name + " が考え中...");
      aiTimer.current = setTimeout(() => {
        setSett(prev => {
          const best = aiBest(prev, nm);
          if (!best) return prev;
          const ns = { ...prev, [best.vid]: { color, type: "s" } };
          const eid = aiRoad(best.vid, roads);
          if (eid !== null) setRoads(r => ({ ...r, [eid]: color }));
          const sc = vScore(best.vid, nm);
          const pt = getPort(best.vid);
          addLog(name + " 配置 [" + sc + "pip" + (pt ? " " + PORT_LABEL[pt.type] + "港" : "") + "]");
          return ns;
        });
        setAiMsg(""); busy.current = false; setTurnIdx(i => i + 1);
      }, wait);
    }
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current); };
  }, [turnIdx, phase]);

  function clickVert(vid) {
    if (!waiting || placing !== "s" || !legal(vid, sett)) return;
    const color = P_COLORS[order[myTurn]];
    setSett(p => ({ ...p, [vid]: { color, type: "s" } }));
    const sc = vScore(vid, nm); const pt = getPort(vid);
    addLog("配置 [" + sc + "pip" + (pt ? " " + PORT_LABEL[pt.type] + "港" : "") + "]");
    setPlacing("r");
  }

  function clickEdge(eid) {
    if (!waiting || placing !== "r" || roads[eid]) return;
    const color = P_COLORS[order[myTurn]];
    setRoads(p => ({ ...p, [eid]: color }));
    addLog("道を配置しました");
    setPlacing("s"); setWaiting(false); busy.current = false; setTurnIdx(i => i + 1);
  }

  function doEvaluate() {
    const result = genEval(sett, nm, order, myTurn);
    setEvalText(result);
    setChat([]);
  }

  function doQuestion() {
    if (!q.trim()) return;
    const qtext = q; setQ("");
    const myColor = P_COLORS[order[myTurn]];
    const myVids = Object.entries(sett).filter(([, s]) => s.color === myColor).map(([vid]) => parseInt(vid));
    const totalPip = myVids.reduce((s, vid) => s + vScore(vid, nm), 0);
    const myResList = myVids.flatMap(vid => vRes(vid));
    const portInfo = myVids.map(vid => {
      const near = B.ports.map(pp => { const d = portDist(vid, pp.vids); return d <= 3 ? PORT_LABEL[pp.type] + d + "手" : null; }).filter(Boolean);
      return near.join(",");
    }).filter(Boolean).join(" / ");

    let ans = "【" + qtext + "への回答】\n";
    const lq = qtext.toLowerCase();
    if (lq.includes("港") || lq.includes("貿易")) {
      ans += myVids.length > 0
        ? "あなたの開拓地から最寄りの港: " + (portInfo || "3手以内に港なし") + "\n港に隣接した場所に道を伸ばすと貿易が有利になります。"
        : "まだ開拓地を配置していません。";
    } else if (lq.includes("pip") || lq.includes("確率")) {
      ans += "あなたの合計pip数は" + totalPip + "pipです。\n";
      if (totalPip >= 18) ans += "高確率で資源が入る優秀な配置です！";
      else if (totalPip >= 14) ans += "標準的な確率です。";
      else ans += "確率がやや低めです。序盤は交渉を積極的に活用しましょう。";
    } else if (lq.includes("資源") || lq.includes("何")) {
      const resNames = [...new Set(myResList)].map(r => RES_LABEL[r]);
      ans += "あなたが取れる資源: " + (resNames.join("・") || "なし") + "\n";
      const resPips = {};
      B.tiles.forEach((t, i) => { if (t.res !== "desert") { if (!resPips[t.res]) resPips[t.res] = 0; resPips[t.res] += PIPS[nm[i]] || 0; } });
      const rare = Object.entries(resPips).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([r]) => RES_LABEL[r]);
      ans += "盤面で希少な資源: " + rare.join("・") + " (交渉で高値で売れます)";
    } else {
      ans += "合計" + totalPip + "pip、資源: " + [...new Set(myResList)].map(r => RES_LABEL[r]).join("・") + "\n";
      ans += portInfo ? "近くの港: " + portInfo : "港まで少し距離があります。";
    }
    setChat(c => [...c, { role: "u", text: qtext }, { role: "a", text: ans }]);
  }

  async function doPhoto() {
    if (!imgB64) return;
    setPhotoLoading(true); setPhotoText("写真を分析中...");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 1024,
          system: "あなたはカタンの専門家です。ボード写真を見て初期配置を分析し日本語でアドバイスします。",
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgB64 } },
            { type: "text", text: "このカタンボードの初期配置を分析してください。" }
          ]}]
        })
      });
      const d = await res.json();
      setPhotoText(d.content?.[0]?.text || "分析できませんでした。");
    } catch (e) {
      setPhotoText("エラー: " + e.message);
    }
    setPhotoLoading(false);
  }

  function Board() {
    return (
      <svg width="100%" viewBox={"0 0 " + SVG_W + " " + SVG_H} style={{ display: "block" }}>
        <defs>
          <pattern id="pf" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <rect width="22" height="22" fill="#2d6a1f"/>
            <polygon points="11,1 16,11 6,11" fill="#1a4a10" opacity="0.85"/>
            <polygon points="11,5 15,14 7,14" fill="#1a4a10" opacity="0.7"/>
            <rect x="10" y="14" width="2" height="4" fill="#5a3010"/>
          </pattern>
          <pattern id="pp" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#6ab832"/>
            <ellipse cx="7" cy="8" rx="4.5" ry="3" fill="white"/>
            <ellipse cx="4.5" cy="6.5" rx="2.5" ry="2.5" fill="white"/>
            <ellipse cx="9.5" cy="6.5" rx="2.5" ry="2.5" fill="white"/>
            <ellipse cx="5.5" cy="5.5" rx="1.5" ry="1.5" fill="#ddd"/>
            <circle cx="4.8" cy="5" r="0.7" fill="#333"/>
            <line x1="5" y1="10.5" x2="5" y2="13" stroke="#999" strokeWidth="1"/>
            <line x1="7" y1="11" x2="7" y2="13.5" stroke="#999" strokeWidth="1"/>
            <line x1="9" y1="10.5" x2="9" y2="13" stroke="#999" strokeWidth="1"/>
            <ellipse cx="17" cy="18" rx="4.5" ry="3" fill="white"/>
            <ellipse cx="14.5" cy="16.5" rx="2.5" ry="2.5" fill="white"/>
            <ellipse cx="19.5" cy="16.5" rx="2.5" ry="2.5" fill="white"/>
            <ellipse cx="15.5" cy="15.5" rx="1.5" ry="1.5" fill="#ddd"/>
            <circle cx="14.8" cy="15" r="0.7" fill="#333"/>
            <line x1="15" y1="20.5" x2="15" y2="23" stroke="#999" strokeWidth="1"/>
            <line x1="17" y1="21" x2="17" y2="23.5" stroke="#999" strokeWidth="1"/>
            <line x1="19" y1="20.5" x2="19" y2="23" stroke="#999" strokeWidth="1"/>
          </pattern>
          <pattern id="pfi" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="#d4a017"/>
            <line x1="0" y1="4" x2="16" y2="4" stroke="#b8860b" strokeWidth="1.5" opacity="0.6"/>
            <line x1="0" y1="8" x2="16" y2="8" stroke="#b8860b" strokeWidth="1.5" opacity="0.6"/>
            <line x1="0" y1="12" x2="16" y2="12" stroke="#b8860b" strokeWidth="1.5" opacity="0.6"/>
            <line x1="2" y1="0" x2="2" y2="4" stroke="#c8a820" strokeWidth="1"/>
            <line x1="6" y1="0" x2="6" y2="4" stroke="#c8a820" strokeWidth="1"/>
            <line x1="10" y1="0" x2="10" y2="4" stroke="#c8a820" strokeWidth="1"/>
            <line x1="14" y1="0" x2="14" y2="4" stroke="#c8a820" strokeWidth="1"/>
            <line x1="4" y1="8" x2="4" y2="12" stroke="#c8a820" strokeWidth="1"/>
            <line x1="8" y1="8" x2="8" y2="12" stroke="#c8a820" strokeWidth="1"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="#c8a820" strokeWidth="1"/>
          </pattern>
          <pattern id="ph" x="0" y="0" width="24" height="16" patternUnits="userSpaceOnUse">
            <rect width="24" height="16" fill="#b84a2a"/>
            <rect x="0" y="0" width="11" height="6" fill="#a03a1f" rx="1" opacity="0.7"/>
            <rect x="13" y="0" width="11" height="6" fill="#a03a1f" rx="1" opacity="0.7"/>
            <rect x="5" y="8" width="14" height="6" fill="#a03a1f" rx="1" opacity="0.7"/>
            <line x1="0" y1="7" x2="24" y2="7" stroke="#c85a3a" strokeWidth="1"/>
            <line x1="12" y1="0" x2="12" y2="7" stroke="#c85a3a" strokeWidth="1"/>
            <line x1="5" y1="7" x2="5" y2="14" stroke="#c85a3a" strokeWidth="1"/>
            <line x1="19" y1="7" x2="19" y2="14" stroke="#c85a3a" strokeWidth="1"/>
          </pattern>
          <pattern id="pm" x="0" y="0" width="32" height="28" patternUnits="userSpaceOnUse">
            <rect width="32" height="28" fill="#7a7a7a"/>
            <polygon points="16,2 28,22 4,22" fill="#5a5a5a" opacity="0.8"/>
            <polygon points="16,4 26,21 6,21" fill="#6a6a6a" opacity="0.5"/>
            <polygon points="16,2 22,12 10,12" fill="white" opacity="0.4"/>
            <polygon points="4,10 12,26 0,26" fill="#5a5a5a" opacity="0.6"/>
            <polygon points="28,12 36,26 20,26" fill="#5a5a5a" opacity="0.6"/>
          </pattern>
          <pattern id="pd" x="0" y="0" width="30" height="20" patternUnits="userSpaceOnUse">
            <rect width="30" height="20" fill="#d9c07a"/>
            <path d="M0,8 Q8,4 16,8 Q24,12 30,8" stroke="#c8a85a" strokeWidth="1.5" fill="none" opacity="0.6"/>
            <path d="M0,14 Q8,10 16,14 Q24,18 30,14" stroke="#c8a85a" strokeWidth="1.5" fill="none" opacity="0.6"/>
          </pattern>
        </defs>
        <rect width={SVG_W} height={SVG_H} fill="#1a6090" rx={6}/>
        {B.tiles.map((t, i) => {
          const pts = hexCorners(t.cx, t.cy, R - 1).map(p => p.join(",")).join(" ");
          const n = nm[i]; const isRed = n === 6 || n === 8;
          const patId = {forest:"pf",pasture:"pp",field:"pfi",hill:"ph",mountain:"pm",desert:"pd"}[t.res];
          return (
            <g key={i}>
              <polygon points={pts} fill={"url(#" + patId + ")"} stroke="#1a1a1a" strokeWidth={1.5}/>
              {n && (
                <g>
                  <circle cx={t.cx} cy={t.cy} r={13} fill="rgba(255,248,220,0.95)" stroke="#aaa" strokeWidth={1}/>
                  <text x={t.cx} y={t.cy - 1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="bold" fill={isRed ? "#c00" : "#222"}>{n}</text>
                  <text x={t.cx} y={t.cy + 8} textAnchor="middle" fontSize={5.5} fill={isRed ? "#c00" : "#666"}>{"•".repeat(PIPS[n])}</text>
                </g>
              )}
            </g>
          );
        })}
        {B.ports.map((p, i) => (
          <g key={"pt" + i}>
            <line x1={p.v1.x} y1={p.v1.y} x2={p.v2.x} y2={p.v2.y} stroke={PORT_COLORS[p.type]} strokeWidth={3} opacity={0.9}/>
            <circle cx={p.px} cy={p.py} r={10} fill={PORT_COLORS[p.type]} stroke="white" strokeWidth={1.5}/>
            <text x={p.px} y={p.py} textAnchor="middle" dominantBaseline="middle" fontSize={4.5} fill="white" fontWeight="bold">{PORT_LABEL[p.type]}</text>
          </g>
        ))}
        {B.edges.map(e => {
          const v1 = B.verts[e.v1], v2 = B.verts[e.v2];
          const c = roads[e.id];
          const canClick = waiting && placing === "r" && !roads[e.id];
          return (
            <g key={"e" + e.id}>
              {c && <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke={P_STYLE[c]} strokeWidth={4} strokeLinecap="round"/>}
              <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="transparent" strokeWidth={12} style={{cursor: canClick ? "pointer" : "default"}} onClick={() => clickEdge(e.id)}/>
            </g>
          );
        })}
        {B.verts.map((v, vid) => {
          const s = sett[vid];
          const canClick = waiting && placing === "s" && legal(vid, sett);
          return (
            <g key={"v" + vid} onClick={() => clickVert(vid)} style={{cursor: canClick ? "pointer" : "default"}}>
              {s ? (
                <g>
                  <rect x={v.x - 4} y={v.y - 3} width={8} height={7} fill={P_STYLE[s.color]} stroke="white" strokeWidth={1.2} rx={1}/>
                  <polygon points={(v.x-5)+","+(v.y-3)+" "+v.x+","+(v.y-9)+" "+(v.x+5)+","+(v.y-3)} fill={P_STYLE[s.color]} stroke="white" strokeWidth={1.2}/>
                </g>
              ) : canClick ? (
                <circle cx={v.x} cy={v.y} r={4} fill="rgba(255,255,255,0.45)" stroke="white" strokeWidth={1}/>
              ) : null}
            </g>
          );
        })}
      </svg>
    );
  }

  const st = {fontFamily:"sans-serif",maxWidth:480,margin:"0 auto",background:"#1a365d",minHeight:"100vh",color:"white"};
  const TABS = ["🗺️ ボード","🤖 AI評価","📸 写真"];

  if (phase === "setup") return (
    <div style={st}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #2d4a7a"}}>
        <h1 style={{margin:0,fontSize:16,fontWeight:"bold"}}>🏝️ カタン初期配置トレーナー</h1>
      </div>
      <div style={{padding:32,textAlign:"center"}}>
        <p style={{color:"#90cdf4",lineHeight:1.8,fontSize:13,marginBottom:8}}>
          サイコロを振って番手を決めましょう。<br/>スネーク順でAI3人と初期配置を行います。
        </p>
        <p style={{color:"#fbd38d",fontSize:12,marginBottom:28}}>開拓地 → 道の順に置いてください</p>
        <button onClick={() => setPhase("roll")} style={{padding:"14px 40px",fontSize:17,background:"#e6a817",border:"none",borderRadius:12,color:"#222",fontWeight:"bold",cursor:"pointer"}}>
          ゲーム開始 🎲
        </button>
      </div>
    </div>
  );

  if (phase === "roll") return (
    <div style={st}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #2d4a7a"}}>
        <h1 style={{margin:0,fontSize:16,fontWeight:"bold"}}>🏝️ カタン初期配置トレーナー</h1>
      </div>
      <div style={{padding:32,textAlign:"center"}}>
        <p style={{color:"#90cdf4",fontSize:14,marginBottom:20}}>サイコロを振って番手を決めましょう！</p>
        <div style={{fontSize:96,lineHeight:1,marginBottom:20}}>{diceFace || "🎲"}</div>
        {myTurnIdx !== null ? (
          <div>
            <p style={{fontSize:20,fontWeight:"bold",color:"#ffd700",marginBottom:6}}>{myTurnIdx + 1}番手！</p>
            <p style={{fontSize:15,color:P_STYLE[P_COLORS[myTurnIdx]],marginBottom:20}}>{P_LABEL[P_COLORS[myTurnIdx]]}コマでプレイします</p>
            <button onClick={() => beginGame(myTurnIdx)} style={{padding:"12px 36px",fontSize:16,background:"#2b6cb0",border:"none",borderRadius:10,color:"white",fontWeight:"bold",cursor:"pointer"}}>
              ゲームスタート！🏝️
            </button>
          </div>
        ) : rolling ? (
          <p style={{color:"#90cdf4",fontSize:14}}>転がってる...</p>
        ) : (
          <button onClick={startRolling} style={{padding:"14px 40px",fontSize:17,background:"#e6a817",border:"none",borderRadius:12,color:"#222",fontWeight:"bold",cursor:"pointer"}}>
            🎲 サイコロを振る
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={st}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #2d4a7a"}}>
        <h1 style={{margin:0,fontSize:16,fontWeight:"bold"}}>🏝️ カタン初期配置トレーナー</h1>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid #2d4a7a"}}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{flex:1,padding:"7px 2px",fontSize:11,border:"none",cursor:"pointer",background:tab===i?"#2b6cb0":"transparent",color:tab===i?"white":"#90cdf4",borderBottom:tab===i?"2px solid #63b3ed":"none"}}>{t}</button>
        ))}
      </div>
      <div style={{padding:"8px 10px"}}>
        {tab === 0 && (
          <>
            <div style={{background:"#2d3748",borderRadius:6,padding:"6px 10px",marginBottom:6,fontSize:12,minHeight:28}}>
              {phase === "done" ? <span style={{color:"#68d391"}}>✅ 配置完了！AI評価タブへどうぞ</span>
                : aiMsg ? <span style={{color:"#fbd38d"}}>⏳ {aiMsg}</span>
                : waiting ? <span style={{color:"#ffd700"}}>👤 {placing === "s" ? "開拓地" : "道"}を置いてください</span>
                : <span>処理中...</span>}
            </div>
            <div style={{display:"flex",gap:4,marginBottom:6}}>
              {[0,1,2,3].map(i => {
                const color = P_COLORS[order[i] ?? i];
                const isCur = phase === "play" && SNAKE[turnIdx] === i;
                return (
                  <div key={i} style={{flex:1,padding:"3px 2px",borderRadius:5,textAlign:"center",background:isCur?"#2b6cb0":"#2d3748",border:"2px solid "+P_STYLE[color]}}>
                    <div style={{fontSize:9,color:"#90cdf4"}}>{i+1}番手</div>
                    <div style={{fontSize:11,fontWeight:"bold",color:P_STYLE[color]}}>{P_LABEL[color]}</div>
                    {i === myTurn && <div style={{fontSize:8,color:"#ffd700"}}>あなた</div>}
                  </div>
                );
              })}
            </div>
            <Board/>
            <div style={{marginTop:6,background:"#2d3748",borderRadius:5,padding:"5px 8px",fontSize:10,color:"#90cdf4",lineHeight:1.6}}>
              {log.slice(-3).map((l, i) => <div key={i}>{l}</div>)}
            </div>
            {phase === "done" && (
              <button onClick={() => setPhase("roll")} style={{width:"100%",marginTop:8,padding:"10px",background:"#2b6cb0",border:"none",borderRadius:8,color:"white",fontSize:13,cursor:"pointer"}}>
                🔄 もう一度プレイ
              </button>
            )}
          </>
        )}
        {tab === 1 && (
          <div>
            <button onClick={doEvaluate} style={{width:"100%",padding:"10px",background:"#2b6cb0",border:"none",borderRadius:8,color:"white",fontSize:13,cursor:"pointer",marginBottom:10}}>
              🤖 AIに評価してもらう
            </button>
            {evalText && (
              <>
                <div style={{background:"#2d3748",borderRadius:8,padding:12,fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:12}}>{evalText}</div>
                <div style={{borderTop:"1px solid #2d4a7a",paddingTop:10}}>
                  <p style={{fontSize:11,color:"#90cdf4",margin:"0 0 8px"}}>💬 質問する</p>
                  {chat.map((m, i) => (
                    <div key={i} style={{marginBottom:6,textAlign:m.role==="u"?"right":"left"}}>
                      <span style={{display:"inline-block",padding:"6px 10px",borderRadius:10,fontSize:12,maxWidth:"85%",lineHeight:1.5,whiteSpace:"pre-wrap",background:m.role==="u"?"#2b6cb0":"#4a5568"}}>{m.text}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:6,marginTop:6}}>
                    <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==="Enter"&&doQuestion()}
                      placeholder="例: 木の港まで何手？"
                      style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid #4a6da0",background:"#2d3748",color:"white",fontSize:12}}/>
                    <button onClick={doQuestion} disabled={!q.trim()} style={{padding:"8px 12px",background:"#2b6cb0",border:"none",borderRadius:8,color:"white",cursor:"pointer",fontSize:12}}>送信</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {tab === 2 && (
          <div>
            <p style={{fontSize:12,color:"#90cdf4",margin:"0 0 8px"}}>実際のボード写真をアップしてAIにアドバイスしてもらいます。</p>
            <button onClick={() => fileRef.current.click()} style={{width:"100%",padding:"12px",background:"#2d4a7a",border:"2px dashed #4a6da0",borderRadius:8,color:"#90cdf4",fontSize:13,cursor:"pointer",marginBottom:10}}>
              📸 写真をアップロード
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={e => {
              const f = e.target.files[0]; if (!f) return;
              setImg(URL.createObjectURL(f));
              const reader = new FileReader();
              reader.onloadend = () => setImgB64(reader.result.split(",")[1]);
              reader.readAsDataURL(f);
            }} style={{display:"none"}}/>
            {img && (
              <>
                <img src={img} alt="board" style={{width:"100%",borderRadius:8,maxHeight:220,objectFit:"contain",background:"#000",marginBottom:8}}/>
                <button onClick={doPhoto} disabled={photoLoading} style={{width:"100%",padding:"10px",background:photoLoading?"#555":"#276749",border:"none",borderRadius:8,color:"white",fontSize:13,cursor:photoLoading?"default":"pointer"}}>
                  {photoLoading ? "⏳ 分析中..." : "🔍 AIに分析してもらう"}
                </button>
              </>
            )}
            {photoText && <div style={{background:"#2d3748",borderRadius:8,padding:12,marginTop:10,fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{photoText}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
