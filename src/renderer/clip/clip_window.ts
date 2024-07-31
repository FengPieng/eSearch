/// <reference types="vite/client" />

const { ipcRenderer, clipboard, nativeImage, shell } = require("electron") as typeof import("electron");
import hotkeys from "hotkeys-js";
import "../../../lib/template2.js";
import { jsKeyCodeDisplay, ele2jsKeyCode } from "../../../lib/key";
import type { MessageBoxSyncOptions } from "electron";
import initStyle from "../root/root";
import open_with from "../../../lib/open_with";
import timeFormat from "../../../lib/time_format";
import { t, lan } from "../../../lib/translate/translate";
import Color from "color";
import fabricSrc from "../../../lib/fabric.min.js?raw";
import store from "../../../lib/store/renderStore";

let Screenshots: typeof import("node-screenshots").Screenshots;
try {
    Screenshots = require("node-screenshots").Screenshots;
} catch (error) {
    const id = ipcRenderer.sendSync("dialog", {
        message: "截屏需要VS运行库才能正常使用\n是否需要从微软官网（https://aka.ms/vs）下载？",
        buttons: ["取消", "下载"],
        defaultId: 1,
    } as MessageBoxSyncOptions);
    if (id === 1) {
        shell.openExternal("https://aka.ms/vs/17/release/vc_redist.x64.exe");
    }
}

import type { setting, EditType, 功能, translateWinType } from "../../ShareTypes.js";
import { ele, elFromId, type ElType, frame, image, input, p, pureStyle, setProperties, trackPoint, txt, view } from "dkh-ui";

import close_svg from "../assets/icons/close.svg";
import ocr_svg from "../assets/icons/ocr.svg";
import search_svg from "../assets/icons/search.svg";
import scan_svg from "../assets/icons/scan.svg";
import open_svg from "../assets/icons/open.svg";
import ding_svg from "../assets/icons/ding.svg";
import record_svg from "../assets/icons/record.svg";
import long_clip_svg from "../assets/icons/long_clip.svg";
import translate_svg from "../assets/icons/translate.svg";
import copy_svg from "../assets/icons/copy.svg";
import save_svg from "../assets/icons/save.svg";

function iconEl(src: string) {
    return view().add(image(src, "icon").class("icon"));
}

function selectMenu() {
    const select = ele("selectmenu")
        .bindGet((el: HTMLSelectElement) => {
            return el.value;
        })
        .bindSet((v, el: HTMLSelectElement) => {
            el.value = v as string;
        });
    return select;
}

function setSetting() {
    工具栏跟随 = store.get("工具栏跟随");
    光标 = store.get("光标");
    四角坐标 = store.get("显示四角坐标");
    取色器默认格式 = store.get("取色器.默认格式");
    for (const i in allColorFormat) {
        if (取色器默认格式 === allColorFormat[i]) {
            取色器格式位置 = Number(i) + 1;
            break;
        }
    }
    遮罩颜色 = store.get("遮罩颜色");
    选区颜色 = store.get("选区颜色");

    initStyle(store);

    取色器显示 = store.get("取色器.显示");
    colorSize = store.get("取色器.大小");
    colorISize = store.get("取色器.像素大小");
    const 工具栏 = store.get("工具栏");
    setProperties({
        "--color-size": `${colorSize * colorISize}px`,
        "--color-i-size": `${colorISize}px`,
        "--color-i-i": `${colorSize}`,
        "--bar-size": `${工具栏.按钮大小}px`,
        "--bar-icon": `${工具栏.按钮图标比例}`,
    });
    bSize = 工具栏.按钮大小;
    记忆框选 = store.get("框选.记忆.开启");
    记忆框选值 = store.get("框选.记忆.rects");
}

/**
 * 修复屏幕信息
 * @see https://github.com/nashaofu/node-screenshots/issues/18
 */
function dispaly2screen(displays: Electron.Display[], screens: import("node-screenshots").Screenshots[]) {
    allScreens = [];
    if (!screens) return;
    // todo 更新算法
    for (const i in displays) {
        const d = displays[i];
        const s = screens[i];
        allScreens.push({ ...d, captureSync: () => s.captureSync(true) });
    }
}

function toCanvas(canvas: HTMLCanvasElement, img: Electron.NativeImage) {
    const image = img;
    const { width: w, height: h } = image.getSize();

    canvas.width = w;
    canvas.height = h;

    const bitmap = image.toBitmap();
    const x = new Uint8ClampedArray(bitmap.length);
    for (let i = 0; i < bitmap.length; i += 4) {
        // 交换R和B通道的值，同时复制G和Alpha通道的值
        x[i] = bitmap[i + 2]; // B
        x[i + 1] = bitmap[i + 1]; // G
        x[i + 2] = bitmap[i]; // R
        x[i + 3] = bitmap[i + 3]; // Alpha
    }
    const d = new ImageData(x, w, h);
    canvas.getContext("2d").putImageData(d, 0, 0);
}

function setScreen(i: (typeof allScreens)[0]) {
    const img = nativeImage.createFromBuffer(i.image);
    const size = img.getSize();
    const w = size.width;
    const h = size.height;
    mainCanvas.width = clipCanvas.width = drawCanvas.width = w;
    mainCanvas.height = clipCanvas.height = drawCanvas.height = h;
    toCanvas(mainCanvas, img);
    fabricCanvas.setHeight(h);
    fabricCanvas.setWidth(w);
    finalRect = [0, 0, mainCanvas.width, mainCanvas.height];
    if (记忆框选)
        if (记忆框选值?.[i.id]?.[2]) {
            finalRect = 记忆框选值[i.id];
            rectSelect = true;
            finalRectFix();
        } // 记忆框选边不为0时
    drawClipRect();
    nowScreenId = i.id;

    if (w < window.innerWidth || h < window.innerHeight) document.body.classList.add("editor_bg");
}

/** 生成一个文件名 */
function getFileName() {
    const saveNameTime = timeFormat(store.get("保存名称.时间"), new Date()).replace("\\", "");
    const filename = store.get("保存名称.前缀") + saveNameTime + store.get("保存名称.后缀");
    return filename;
}

/** 快速截屏 */
function quickClip() {
    const fs = require("node:fs");
    (Screenshots.all() ?? []).forEach((c) => {
        let image = nativeImage.createFromBuffer(c.captureSync(true));
        if (store.get("快速截屏.模式") === "clip") {
            clipboard.writeImage(image);
            image = null;
        } else if (store.get("快速截屏.模式") === "path" && store.get("快速截屏.路径")) {
            const filename = `${store.get("快速截屏.路径")}${getFileName()}.png`;
            checkFile(1, filename, filename);
        }
        function checkFile(n: number, name: string, baseName: string) {
            // 检查文件是否存在于当前目录中。
            fs.access(name, fs.constants.F_OK, (err) => {
                if (!err) {
                    /* 存在文件，需要重命名 */
                    name = baseName.replace(/\.png$/, `(${n}).png`);
                    checkFile(n + 1, name, baseName);
                } else {
                    fs.writeFile(
                        name,
                        Buffer.from(image.toDataURL().replace(/^data:image\/\w+;base64,/, ""), "base64"),
                        (err) => {
                            if (err) return;
                            ipcRenderer.send("clip_main_b", "ok_save", name);
                            image = null;
                        }
                    );
                }
            });
        }
    });
}

function setEditorP(zoom: number, x: number, y: number) {
    const t = [];
    if (zoom != null) {
        t.push(`scale(${zoom})`);
        editorP.zoom = zoom;
    }
    if (x != null) {
        t.push(`translateX(${x}px)`);
        editorP.x = x;
    }
    if (y != null) {
        t.push(`translateY(${y}px)`);
        editorP.y = y;
    }
    editor.style.transform = t.join(" ");
}

function edge() {
    const canvas = mainCanvas;
    let src = cv.imread(canvas);

    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB);
    // cv.imshow(canvas, src);

    let dst = new cv.Mat();
    const cMin = store.get("框选.自动框选.最小阈值");
    const cMax = store.get("框选.自动框选.最大阈值");
    cv.Canny(src, dst, cMin, cMax, 3, true);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.findContours(dst, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const r = cv.boundingRect(cnt);
        r.type = "image";
        edgeRect.push(r);
    }

    // cv.imshow(canvas, dst);

    src.delete();
    dst.delete();
    contours.delete();
    hierarchy.delete();

    src = dst = contours = hierarchy = null;
}

function getLinuxWin() {
    if (process.platform !== "linux") return;
    const x11 = require("x11");
    const X = x11.createClient((err, display) => {
        if (err) {
            console.error(err);
            return;
        }
        for (const i of display.screen) {
            X.QueryTree(i.root, (_err, tree) => {
                for (const x of tree.children) {
                    X.GetWindowAttributes(x, (_err, attrs) => {
                        if (attrs.mapState === 2) {
                            X.GetGeometry(x, (_err, clientGeom) => {
                                edgeRect.push({
                                    x: clientGeom.xPos,
                                    y: clientGeom.yPos,
                                    width: clientGeom.width,
                                    height: clientGeom.height,
                                    type: "system",
                                });
                            });
                        }
                    });
                }
            });
        }
    });
}

function getWinWin() {
    if (process.platform !== "win32") return;
    const { exec } = require("node:child_process");
    const runPath = ipcRenderer.sendSync("run_path");
    exec(`${runPath}/lib/win_rect.exe`, (err, out) => {
        console.log(out);
        if (!err) {
            out = out.replaceAll("\x00", "");
            const r = JSON.parse(out);
            for (const i of r) edgeRect.push({ x: i.x, y: i.y, width: i.width, height: i.height, type: "system" });
        }
    });
}

function sCenterBar(m) {
    hotkeys.deleteScope("c_bar");
    if (centerBarM === m) {
        centerBarShow = false;
        centerBarM = null;
    } else {
        centerBarShow = true;
        centerBarM = m;
    }
    if (m === false) centerBarShow = false;
    if (centerBarShow) {
        document.getElementById("save_type").style.height = "0";
        document.getElementById("save_type").style.width = "0";
        document.getElementById("center_bar").style.opacity = "1";
        document.getElementById("center_bar").style.pointerEvents = "auto";
        toHotkeyScope("c_bar");
    } else {
        document.getElementById("center_bar").style.opacity = "0";
        document.getElementById("center_bar").style.pointerEvents = "none";
        backHotkeyScope();
    }
    switch (m) {
        case "save":
            document.getElementById("save_type").style.height = "";
            document.getElementById("save_type").style.width = "";
            break;
    }
}

function toHotkeyScope(scope: hotkeyScope) {
    if (hotkeyScopes.at(-1) !== scope) hotkeyScopes.push(scope);
    hotkeys.setScope(scope);
}
function backHotkeyScope() {
    if (hotkeyScopes.length > 1) hotkeyScopes.pop();
    hotkeys.setScope(hotkeyScopes.at(-1));
    console.log(hotkeys.getScope(), hotkeyScopes);
}

function setDefaultAction(act: setting["框选后默认操作"]) {
    if (!act) return;
    autoDo = act;
    if (autoDo !== "no") {
        toolBarEl.els[autoDo].el.style.backgroundColor = "var(--hover-color)";
    }
}

function 记忆框选f() {
    if (记忆框选 && !longInited) {
        记忆框选值[nowScreenId] = [finalRect[0], finalRect[1], finalRect[2], finalRect[3]];
        store.set("框选.记忆.rects", 记忆框选值);
    }
}

// 关闭
function closeWin() {
    document.querySelector("html").style.display = "none"; /* 退出时隐藏，透明窗口，动画不明显 */
    记忆框选f();
    mainCanvas.width = clipCanvas.width = drawCanvas.width = mainCanvas.width; // 确保清空画布
    if (uIOhook) {
        uIOhook.stop();
    }
    setTimeout(() => {
        ipcRenderer.send("clip_main_b", "window-close");
    }, 50);
}

function runOcr() {
    const type = ocr引擎.gv();
    getClipPhoto("png").then((c: HTMLCanvasElement) => {
        ipcRenderer.send("clip_main_b", "ocr", [c.toDataURL(), type]);
    });
    tool.close();
}

function runSearch() {
    const type = 识图引擎.gv();
    getClipPhoto("png").then((c: HTMLCanvasElement) => {
        ipcRenderer.send("clip_main_b", "search", [c.toDataURL(), type]);
    });
    tool.close();
}
// 二维码
function runQr() {
    getClipPhoto("png").then(async (c: HTMLCanvasElement) => {
        ipcRenderer.send("clip_main_b", "QR", c.toDataURL());
        tool.close();
    });
}

function drawM(v: boolean) {
    if (v) {
        // 绘画模式
        document.getElementById("clip_photo").style.pointerEvents = "none";
        document.getElementById("clip_wh").style.pointerEvents = "none";
    } else {
        // 裁切模式
        document.getElementById("clip_photo").style.pointerEvents = "auto";
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        document.getElementById("clip_wh").style.pointerEvents = "auto";
    }
}

/**
 * 编辑栏跟踪工具栏
 */
function trackLocation() {
    const h = toolBar.offsetTop;
    let l = toolBar.offsetLeft + toolBar.offsetWidth + 8;
    if (drawBarPosi === "left") {
        l = toolBar.offsetLeft - drawBar.offsetWidth - 8;
    }
    drawBar.style.top = `${h}px`;
    drawBar.style.left = `${l}px`;
}

// 在其他应用打开

function openApp() {
    const path = require("node:path");
    const os = require("node:os");
    const tmpPhoto = path.join(os.tmpdir(), "/eSearch/tmp.png");
    const fs = require("node:fs");
    getClipPhoto("png").then((c: HTMLCanvasElement) => {
        const f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
        const dataBuffer = Buffer.from(f, "base64");
        fs.writeFile(tmpPhoto, dataBuffer, () => {
            open_with(tmpPhoto);
        });
    });
}

function initRecord() {
    ipcRenderer.send("clip_main_b", "record", {
        rect: finalRect,
        id: nowScreenId,
        w: mainCanvas.width,
        h: mainCanvas.height,
        ratio: ratio,
    });
    tool.close();
}

function long_s() {
    let s = allScreens.find((i) => i.id === nowScreenId);
    let x = nativeImage.createFromBuffer(s.captureSync());
    addLong(x.getBitmap(), x.getSize().width, x.getSize().height);
    s = x = null;
}

function startLong() {
    initLong(finalRect);
    const r = [...finalRect];
    r[0] += screenPosition[nowScreenId].x;
    r[1] += screenPosition[nowScreenId].y;
    long_s();
    ipcRenderer.send("clip_main_b", "long_s", r);
    if (!cv) cv = require("opencv.js");
    uIOhook = require("uiohook-napi").uIOhook;
    uIOhook.start();
    uIOhook.on("keyup", () => {
        long_s();
    });
    uIOhook.on("wheel", () => {
        const n = new Date().getTime();
        if (n - lastLong > 500) {
            lastLong = n;
            long_s();
        }
    });
}

function initLong(rect: number[]) {
    longRunning = true;
    longInited = true;
    const l = [
        toolBar,
        drawBar,
        mainCanvas,
        clipCanvas,
        drawCanvas,
        document.getElementById("draw_photo_top"),
        whEl.el,
        mouseBarEl,
    ];

    for (const i of l) {
        i.style.display = "none";
    }

    document.body.classList.remove("editor_bg");

    记忆框选值[nowScreenId] = [rect[0], rect[1], rect[2], rect[3]];
    store.set("框选.记忆.rects", 记忆框选值);

    lr.style({
        left: `${rect[0] / ratio}px`,
        top: `${rect[1] / ratio}px`,
        width: `${rect[2] / ratio}px`,
        height: `${rect[3] / ratio}px`,
    });
    const w = 16;
    let right = 0;
    let botton = 0;
    if ((rect[2] + rect[3]) / ratio + w > window.innerHeight) {
        if ((rect[0] + rect[2]) / ratio + w > window.innerWidth) {
        } else {
            right = -w;
        }
    } else {
        botton = -w;
    }
    finishLongB.style.right = `${right}px`;
    finishLongB.style.bottom = `${botton}px`;
    finishLongB.onclick = () => {
        // 再截屏以覆盖结束按钮
        long_s();

        lr.style({ opacity: "0" });
        ipcRenderer.send("clip_main_b", "long_e", nowScreenId);
        addLong(null, null, null);
        for (const i of l) {
            i.style.display = "";
        }
    };

    let longWidth = 0;
    if (window.innerWidth - (rect[0] + rect[2]) / ratio >= rect[1] / ratio) {
        // 右边
        longPreview.style({ right: "0", left: "auto" });
        longWidth = window.innerWidth - (rect[0] + rect[2]) / ratio - w;
    } else {
        longPreview.style({ left: "0" });
        longWidth = rect[1] / ratio - w;
    }
    longPreview.style({ display: longWidth < 100 ? "none" : "", width: `${longWidth}px`, height: "100vh" });
}

function addLong(x: Buffer, w: number, h: number) {
    if (!x) {
        uIOhook.stop();
        uIOhook = null;
        pjLong();
        return;
    }
    // 原始区域
    const canvas = ele("canvas").el;
    for (let i = 0; i < x.length; i += 4) {
        [x[i], x[i + 2]] = [x[i + 2], x[i]];
    }
    const d = new ImageData(Uint8ClampedArray.from(x), w, h);
    // 设定canvas宽高并设置裁剪后的图像
    canvas.width = finalRect[2];
    canvas.height = finalRect[3];
    canvas.getContext("2d").putImageData(d, -finalRect[0], -finalRect[1]);

    if (!longX.lastImg) {
        longPutImg(canvas, 0, 0);
        longX.lastImg = canvas;
        return;
    }

    const match = longMatch(longX.lastImg, canvas);
    console.log(match);

    const dx = match.dx;
    const dy = match.dy;
    const putImg = match.clipedImg;
    longPutImg(putImg, dx + longX.lastXY.x, dy + longX.lastXY.y);

    longX.lastImg = canvas;
    longX.lastXY.x += match.srcDX;
    longX.lastXY.y += match.srcDY;
}

function longMatch(img0: HTMLCanvasElement, img1: HTMLCanvasElement) {
    // clip img1 “回”字中间的“口”
    function clip(v: number) {
        const x = v - Math.max((v / 3) * 1, 50);
        return Math.floor(Math.max(x, 0) / 2);
    }
    const dw = clip(img1.width);
    const dh = clip(img1.height);

    const clip1Canvas = ele("canvas").el;
    clip1Canvas.width = img1.width - dw * 2;
    clip1Canvas.height = img1.height - dh * 2;
    clip1Canvas.getContext("2d").drawImage(img1, -dw, -dh);
    // match
    const src = cv.imread(img0);
    const templ = cv.imread(clip1Canvas);
    const dst = new cv.Mat();
    const mask = new cv.Mat();
    cv.matchTemplate(src, templ, dst, cv.TM_CCOEFF, mask);
    const result = cv.minMaxLoc(dst, mask);
    const maxPoint = result.maxLoc;
    const dx = maxPoint.x;
    const dy = maxPoint.y;
    src.delete();
    dst.delete();
    mask.delete();
    // clip img1
    const ndx = dx - dw;
    const ndy = dy - dh;
    // 0:裁切九宫格边的三个格 !=0:裁出“田”字
    const clip2Canvas = ele("canvas").el;
    clip2Canvas.width = ndx !== 0 ? img1.width - dw : img1.width;
    clip2Canvas.height = ndy !== 0 ? img1.height - dh : img1.height;
    // d>0需要-dw或-dh平移，<=0不需要平移
    clip2Canvas.getContext("2d").drawImage(img1, ndx > 0 ? -dw : 0, ndy > 0 ? -dh : 0);

    return { dx: ndx > 0 ? dx : ndx, dy: ndy > 0 ? dy : ndy, srcDX: ndx, srcDY: ndy, clipedImg: clip2Canvas };
}

function longPutImg(img: HTMLCanvasElement, x: number, y: number) {
    // 前提：img大小一定小于等于最终拼接canvas
    const newCanvas = ele("canvas").el;

    const srcW = longX.img?.width || 0;
    const srcH = longX.img?.height || 0;
    const minX = longX.imgXY.x;
    const minY = longX.imgXY.y;
    const maxX = minX + srcW;
    const maxY = minY + srcH;

    let srcDx = 0;
    let srcDy = 0;

    if (x < minX) {
        srcDx = minX - x;
        newCanvas.width = srcDx + srcW;
        longX.imgXY.x -= srcDx;
    } else if (x + img.width > maxX) {
        newCanvas.width = x + img.width - maxX + srcW;
    } else {
        newCanvas.width = srcW;
    }
    if (y < minY) {
        srcDy = minY - y;
        newCanvas.height = srcDy + srcH;
        longX.imgXY.y -= srcDy;
    } else if (y + img.height > maxY) {
        newCanvas.height = y + img.height - maxY + srcH;
    } else {
        newCanvas.height = srcH;
    }

    if (longX.img) newCanvas.getContext("2d").drawImage(longX.img, srcDx, srcDy);

    const nx = x - longX.imgXY.x;
    const ny = y - longX.imgXY.y;
    newCanvas.getContext("2d").drawImage(img, nx, ny);
    longX.img = newCanvas;

    longPreview.clear();
    newCanvas.style.maxWidth = "100%";
    newCanvas.style.maxHeight = "100%";
    longPreview.add(newCanvas);
}

function pjLong() {
    const oCanvas = longX.img;
    mainCanvas.width = clipCanvas.width = drawCanvas.width = oCanvas.width;
    mainCanvas.height = clipCanvas.height = drawCanvas.height = oCanvas.height;

    const ggid = oCanvas.getContext("2d").getImageData(0, 0, oCanvas.width, oCanvas.height);
    mainCanvas.getContext("2d").putImageData(ggid, 0, 0);

    finalRect = [0, 0, oCanvas.width, oCanvas.height];

    fabricCanvas.setWidth(oCanvas.width);
    fabricCanvas.setHeight(oCanvas.height);

    longPreview.style({ display: "none" });
    longPreview.clear();

    document.body.classList.add("editor_bg");

    lr.style({ width: "0", height: "0" });

    longRunning = false;
}

// 钉在屏幕上
function runDing() {
    getClipPhoto("png").then((c: HTMLCanvasElement) => {
        const display = allScreens.find((i) => i.id === nowScreenId);
        const dingWindowArg = [
            finalRect[0] / ratio + display.bounds.x,
            finalRect[1] / ratio + display.bounds.y,
            finalRect[2] / ratio,
            finalRect[3] / ratio,
            c.toDataURL(),
        ];
        ipcRenderer.send("clip_main_b", "ding", dingWindowArg);
        tool.close();
    });
}

function translate() {
    const display = allScreens.find((i) => i.id === nowScreenId);
    ipcRenderer.send("clip_main_b", "translate", {
        rect: {
            x: finalRect[0],
            y: finalRect[1],
            w: finalRect[2],
            h: finalRect[3],
        },
        dipRect: {
            x: finalRect[0] / ratio + display.bounds.x,
            y: finalRect[1] / ratio + display.bounds.y,
            w: finalRect[2] / ratio,
            h: finalRect[3] / ratio,
        },
        displayId: nowScreenId,
    } as translateWinType);
    tool.close();
}

// 复制
function runCopy() {
    getClipPhoto("png").then((c: HTMLCanvasElement) => {
        clipboard.writeImage(nativeImage.createFromDataURL(c.toDataURL()));
        tool.close();
    });
}
// 保存
function runSave() {
    if (store.get("保存.快速保存")) {
        type = store.get("保存.默认格式");
        const path = require("node:path") as typeof import("path");
        const savedPath = store.get("保存.保存路径.图片") || "";
        const p = path.join(savedPath, `${get_file_name()}.${store.get("保存.默认格式")}`);
        function get_file_name() {
            const saveNameTime = timeFormat(store.get("保存名称.时间"), new Date()).replace("\\", "");
            const filename = store.get("保存名称.前缀") + saveNameTime + store.get("保存名称.后缀");
            return filename;
        }
        save(p);
        return;
    }
    sCenterBar("save");
    const els = Array.from(document.querySelectorAll("#suffix > div")) as HTMLElement[];
    const type2N = els.map((i) => i.getAttribute("data-value"));
    let i = type2N.indexOf(store.get("保存.默认格式"));
    els[i].className = "suffix_h";
    document.getElementById("suffix").onclick = (e) => {
        const el = <HTMLDivElement>e.target;
        if (el.dataset.value) {
            ipcRenderer.send("clip_main_b", "save", el.dataset.value);
            type = el.dataset.value as typeof type;
            sCenterBar("save");
        }
    };
    toHotkeyScope("c_bar");
    hotkeys("enter", "c_bar", () => {
        (<HTMLDivElement>document.querySelector("#suffix > .suffix_h")).click();
        sCenterBar("save");
    });
    const l = type2N.length;
    hotkeys("up", "c_bar", () => {
        els[i % l].className = "";
        i = i === 0 ? l - 1 : i - 1;
        els[i % l].className = "suffix_h";
    });
    hotkeys("down", "c_bar", () => {
        els[i % l].className = "";
        i++;
        els[i % l].className = "suffix_h";
    });
    hotkeys("esc", "c_bar", () => {
        sCenterBar("save");
    });
}
function save(message: string) {
    if (message) {
        const fs = require("node:fs");
        getClipPhoto(type).then((c) => {
            let dataBuffer: Buffer;
            if (type === "svg") {
                dataBuffer = Buffer.from(<string>c);
            } else {
                let f = "";
                const nc = <HTMLCanvasElement>c;
                if (type === "png") {
                    f = nc.toDataURL("image/png", 1);
                } else if (type === "jpg") {
                    f = nc.toDataURL("image/jpeg", 1);
                } else if (type === "webp") {
                    f = nc.toDataURL("image/webp", 1);
                }
                dataBuffer = Buffer.from(f.replace(/^data:image\/\w+;base64,/, ""), "base64");
                if (store.get("保存.保存并复制")) {
                    clipboard.writeImage(nativeImage.createFromDataURL(f));
                }
            }

            fs.writeFile(message, dataBuffer, (err) => {
                if (!err) {
                    ipcRenderer.send("clip_main_b", "ok_save", message);
                }
            });
        });
        tool.close();
    }
}
/**
 * 获取选区图像
 * @param type 格式
 * @returns promise svg base64|canvas element
 */
function getClipPhoto(type: string) {
    const mainCtx = mainCanvas.getContext("2d");
    if (!finalRect) finalRect = [0, 0, mainCanvas.width, mainCanvas.height];

    if (typeof fabricCanvas !== "undefined") {
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
    }

    if (type === "svg") {
        const svg = document.createElement("div");
        if (typeof fabricCanvas === "undefined") {
            svg.innerHTML = `<!--?xml version="1.0" encoding="UTF-8" standalone="no" ?-->
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${mainCanvas.width}" height="${mainCanvas.height}" viewBox="0 0 1920 1080" xml:space="preserve">
            <desc>Created with eSearch</desc>
            </svg>`;
        } else {
            svg.innerHTML = fabricCanvas.toSVG();
            svg.querySelector("desc").innerHTML = "Created with eSearch & Fabric.js";
        }
        svg.querySelector("svg").setAttribute("viewBox", finalRect.join(" "));
        const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("xlink:href", mainCanvas.toDataURL());
        svg.querySelector("svg").insertBefore(image, svg.querySelector("svg").firstChild);
        const svgT = new XMLSerializer().serializeToString(svg.querySelector("svg"));
        return new Promise((resolve, _rejects) => {
            resolve(svgT);
        });
    }
        const tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = finalRect[2];
        tmpCanvas.height = finalRect[3];
        const gid = mainCtx.getImageData(finalRect[0], finalRect[1], finalRect[2], finalRect[3]); // 裁剪
        tmpCanvas.getContext("2d").putImageData(gid, 0, 0);
        const image = document.createElement("img");
        image.src = fabricCanvas.toDataURL({
            left: finalRect[0],
            top: finalRect[1],
            width: finalRect[2],
            height: finalRect[3],
            format: type,
        });
        return new Promise((resolve, _rejects) => {
            image.onload = () => {
                tmpCanvas.getContext("2d").drawImage(image, 0, 0, finalRect[2], finalRect[3]);
                if (!isRect) {
                    const ctx = tmpCanvas.getContext("2d");

                    // 创建临时Canvas并保存原始内容
                    const tempCanvas = createTemporaryCanvas(tmpCanvas);

                    // 清除主Canvas
                    ctx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);

                    // 定义裁剪区域
                    ctx.beginPath();
                    freeSelect.forEach((point, index) => {
                        if (index === 0) {
                            ctx.moveTo(point.x - finalRect[0], point.y - finalRect[1]);
                        } else {
                            ctx.lineTo(point.x - finalRect[0], point.y - finalRect[1]);
                        }
                    });
                    ctx.closePath();
                    ctx.clip();

                    // 将原始内容重新绘制到主Canvas上
                    ctx.drawImage(tempCanvas, 0, 0);
                }
                resolve(tmpCanvas);
            };
        });
}

function createTemporaryCanvas(originalCanvas: HTMLCanvasElement) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = originalCanvas.width;
    tempCanvas.height = originalCanvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(originalCanvas, 0, 0);
    return tempCanvas;
}

// 鼠标框选坐标转画布坐标,鼠标坐标转画布坐标
function pXY2cXY(canvas: HTMLCanvasElement, oX1: number, oY1: number, oX2: number, oY2: number): rect {
    // 0_零_1_一_2_二_3 阿拉伯数字为点坐标（canvas），汉字为像素坐标（html）
    // 输入为边框像素坐标
    // 为了让canvas获取全屏，边框像素点要包括
    // 像素坐标转为点坐标后,左和上(小的)是不变的,大的少1
    let x1 = Math.min(oX1, oX2);
    let y1 = Math.min(oY1, oY2);
    let x2 = Math.max(oX1, oX2) + 1;
    let y2 = Math.max(oY1, oY2) + 1;
    // canvas缩放变换
    x1 = Math.round(canvas.width * (x1 / canvas.offsetWidth));
    y1 = Math.round(canvas.height * (y1 / canvas.offsetHeight));
    x2 = Math.round(canvas.width * (x2 / canvas.offsetWidth));
    y2 = Math.round(canvas.height * (y2 / canvas.offsetHeight));
    return [x1, y1, x2 - x1, y2 - y1];
}

function pXY2cXY2(canvas: HTMLCanvasElement, oX1: number, oY1: number): point {
    // canvas缩放变换
    const x1 = Math.round(canvas.width * (oX1 / canvas.offsetWidth));
    const y1 = Math.round(canvas.height * (oY1 / canvas.offsetHeight));

    return { x: x1, y: y1 };
}

function pointsOutRect(points: point[]): rect {
    if (points.length === 0) {
        return null; // 如果点集为空，返回null
    }

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    // 遍历所有点，找到最小和最大的x,y坐标
    for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }

    // 返回边框的左下角和右上角坐标
    return [minX, minY, maxX - minX, maxY - minY];
}

// 开始操纵框选
function clipStart(p: editor_position, inRect: boolean) {
    if (isRect) {
        // 在选区内，则调整，否则新建
        if (inRect) {
            isInClipRect(p);
            oldP = { x: p.x, y: p.y };
            oFinalRect = finalRect;
            moving = true;
            moveRect(oFinalRect, p, p);
        } else {
            selecting = true;
            canvasRect = [p.x, p.y]; // 用于框选
            finalRect = pXY2cXY(clipCanvas, canvasRect[0], canvasRect[1], p.x, p.y);
            rightKey = false;
            changeRightBar(false);
        }
    } else {
        if (inRect) {
            oldP = { x: p.x, y: p.y };
            oPoly = structuredClone(freeSelect);
            moving = true;
            movePoly(oPoly, p, p);
        } else {
            selecting = true;
            freeSelect = [p];
            finalRect = pointsOutRect(freeSelect);
            rightKey = false;
            changeRightBar(false);
        }
    }
    // 隐藏
    drawBar.style.opacity = toolBar.style.opacity = "0";
}

function pickColor(p: editor_position) {
    rightKey = !rightKey;
    // 自由右键取色
    nowCanvasPosition = pXY2cXY(clipCanvas, p.x, p.y, p.x, p.y);
    mouseBar(finalRect, nowCanvasPosition[0], nowCanvasPosition[1]);
    // 改成多格式样式
    if (rightKey) {
        changeRightBar(true);
    } else {
        changeRightBar(false);
    }
}

function clipEnd(p: editor_position) {
    clipCtx.closePath();
    selecting = false;
    nowCanvasPosition = pXY2cXY(clipCanvas, p.x, p.y, p.x, p.y);
    if (isRect) {
        if (!moved && down) {
            rectSelect = true;
            let min = [];
            let minN = Number.POSITIVE_INFINITY;
            for (const i of rectInRect) {
                if (i[2] * i[3] < minN) {
                    min = i;
                    minN = i[2] * i[3];
                }
            }
            if (min.length !== 0) finalRect = min as rect;
            drawClipRect();
        } else {
            finalRect = pXY2cXY(clipCanvas, canvasRect[0], canvasRect[1], p.x, p.y);
            drawClipRect();
        }
    } else {
        freeSelect.push(pXY2cXY2(clipCanvas, p.x, p.y));
        finalRect = pointsOutRect(freeSelect);
        drawClipPoly(freeSelect);
    }
    hisPush();
}

/** 画框(遮罩) */
function drawClipRect() {
    const cw = clipCanvas.width;
    const ch = clipCanvas.height;

    clipCtx.clearRect(0, 0, cw, ch);
    clipCtx.beginPath();

    const x = finalRect[0];
    const y = finalRect[1];
    const width = finalRect[2];
    const height = finalRect[3];

    // 框选为黑色遮罩
    clipCtx.fillStyle = 遮罩颜色;

    const topMaskHeight = y;
    const leftMaskWidth = x;
    const rightMaskWidth = cw - (x + width);
    const bottomMaskHeight = ch - (y + height);

    clipCtx.fillRect(0, 0, cw, topMaskHeight);
    clipCtx.fillRect(0, y, leftMaskWidth, height);
    clipCtx.fillRect(x + width, y, rightMaskWidth, height);
    clipCtx.fillRect(0, y + height, cw, bottomMaskHeight);

    clipCtx.fillStyle = 选区颜色;
    clipCtx.fillRect(x, y, width, height);

    // 大小栏
    whBar(finalRect);
}

/** 画多边形(遮罩) */
function drawClipPoly(points: point[]) {
    const ctx = clipCtx;
    const canvas = clipCanvas;
    if (points.length < 2) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 遮罩颜色;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 创建内部镂空效果
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.fillStyle = "#fff";
    ctx.closePath();
    ctx.fill();

    // 恢复默认绘图模式
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.fillStyle = 选区颜色;
    ctx.closePath();
    ctx.fill();

    // 大小栏
    whBar(pointsOutRect(points));
}

/**
 * 自动框选提示
 */
function inEdge(p: editor_position) {
    if (rectSelect) return;
    console.log(1);

    rectInRect = [];
    for (const i of edgeRect) {
        const x0 = i.x;
        const y0 = i.y;
        const x1 = i.x + i.width;
        const y1 = i.y + i.height;
        if (x0 < p.x && p.x < x1 && y0 < p.y && p.y < y1) {
            rectInRect.push([i.x, i.y, i.width, i.height]);
        }
    }
    clipCtx.clearRect(0, 0, clipCanvas.width, clipCanvas.height);
    clipCtx.beginPath();
    clipCtx.strokeStyle = "#000";
    clipCtx.lineWidth = 1;
    for (const i of rectInRect) {
        clipCtx.strokeRect(i[0], i[1], i[2], i[3]);
    }
}

// 大小栏
function whBar(finalRect: rect) {
    // 大小文字
    let x0: number;
    let y0: number;
    let x1: number;
    let y1: number;
    let d: number;
    d = 光标 === "以(1,1)为起点" ? 1 : 0;
    x0 = finalRect[0] + d;
    y0 = finalRect[1] + d;
    x1 = finalRect[0] + d + finalRect[2];
    y1 = finalRect[1] + d + finalRect[3];
    whX0.el.value = String(x0);
    whY0.el.value = String(y0);
    whX1.el.value = String(x1);
    whY1.el.value = String(y1);
    whW.el.value = String(finalRect[2]);
    whH.el.value = String(finalRect[3]);
    checkWhBarWidth();
    // 位置
    const zx = (finalRect[0] + editorP.x) * editorP.zoom;
    const zy = (finalRect[1] + editorP.y) * editorP.zoom;
    const zw = finalRect[2] * editorP.zoom;
    const zh = finalRect[3] * editorP.zoom;
    const dw = whEl.el.offsetWidth;
    const dh = whEl.el.offsetHeight;
    let x: number;
    function setLeft(l: number) {
        whEl.style({ right: "", left: `${l}px` });
    }
    function setRight() {
        whEl.style({ right: "0px", left: "" });
    }
    if (dw >= zw) {
        if (dw + zx <= window.innerWidth) {
            x = zx; // 对齐框的左边
            setLeft(x);
        } else {
            setRight();
        }
    } else {
        x = zx + zw / 2 - dw / 2;
        if (x + dw <= window.innerWidth) {
            setLeft(x);
        } else {
            setRight();
        }
    }
    let y: number;
    if (zy - (dh + 10) >= 0) {
        y = zy - (dh + 10); // 不超出时在外
    } else {
        if (zy + zh + 10 + dh <= window.innerHeight) {
            y = zy + zh + 10;
        } else {
            y = zy + 10;
        }
    }
    whEl.style({ top: `${y}px` });
}

function checkWhBarWidth() {
    whL.forEach((el) => {
        el.style({ width: `${el.el.value.length}ch` });
    });
}

function changeWH(el: ElType<HTMLInputElement>) {
    let l = whL.map((i) => i.el.value);
    l = l.map((string) => {
        // 排除（数字运算符空格）之外的非法输入
        if (string.match(/[\d\+\-*/\.\s\(\)]/g).length !== string.length) return null;
        return eval(string);
    });

    if (l.includes(null)) {
        whBar(finalRect);
        return;
    }

    const d = 光标 === "以(1,1)为起点" ? 1 : 0;
    if (el === whX0 || el === whY0) {
        finalRect[0] = Number(l[0]) - d;
        finalRect[1] = Number(l[1]) - d;
    } else if (el === whX1 || el === whY1) {
        finalRect[2] = Number(l[2]) - finalRect[0] - d;
        finalRect[3] = Number(l[3]) - finalRect[1] - d;
    } else {
        finalRect[2] = Number(l[4]);
        finalRect[3] = Number(l[5]);
    }
    finalRectFix();
    hisPush();
    drawClipRect();
    followBar();
}

function mouseBar(finalRect: rect, x: number, y: number) {
    requestAnimationFrame(() => {
        const [x0, y0, width, height] = finalRect;

        const delta = (colorSize - 1) / 2;
        const xOffset = x - delta;
        const yOffset = y - delta;

        const centerIndex = (colorSize * delta + delta) * 4;

        const imageData = mainCanvasContext.getImageData(xOffset, yOffset, colorSize, colorSize);

        pointColorCanvasCtx.clearRect(0, 0, colorSize, colorSize);
        pointColorCanvasBgCtx.clearRect(0, 0, colorSize, colorSize);

        pointColorCanvasBgCtx.putImageData(imageData, 0, 0);

        let points = [];

        if (isRect || freeSelect.length < 3) {
            points.push({ x: x0, y: y0 });
            points.push({ x: x0, y: y0 + height });
            points.push({ x: x0 + width, y: y0 + height });
            points.push({ x: x0 + width, y: y0 });
        } else {
            points = freeSelect;
        }

        pointColorCanvasCtx.save();

        pointColorCanvasCtx.beginPath();
        pointColorCanvasCtx.moveTo(points[0].x - xOffset, points[0].y - yOffset);
        for (let i = 1; i < points.length; i++) {
            pointColorCanvasCtx.lineTo(points[i].x - xOffset, points[i].y - yOffset);
        }
        pointColorCanvasCtx.closePath();
        pointColorCanvasCtx.clip();
        pointColorCanvasCtx.drawImage(pointColorCanvasBg, 0, 0);

        pointColorCanvasCtx.restore();

        let [r, g, b, a] = imageData.data.slice(centerIndex, centerIndex + 4);

        a /= 255;
        pointCenter.style.background = `rgba(${r}, ${g}, ${b}, ${a})`;
        theColor = [r, g, b, a];
        clipColorText(theColor, 取色器默认格式);

        const d = 光标 === "以(1,1)为起点" ? 1 : 0;
        document.getElementById("clip_xy").innerText = `(${x + d}, ${y + d})`;
    });
}

// 色彩空间转换
function colorConversion(rgba: number[] | string, type: string): string {
    const color = new Color(rgba);
    if (color.alpha() !== 1) return "/";
    switch (type) {
        case "HEX":
            return color.hex();
        case "RGB":
            return color.rgb().string();
        case "HSL": {
            const hsl = color.hsl().round().array();
            return `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
        }
        case "HSV": {
            const hsv = color.hsv().round().array();
            return `hsv(${hsv[0]}, ${hsv[1]}%, ${hsv[2]}%)`;
        }
        case "CMYK": {
            const cmyk = color.cmyk().round().array();
            return `cmyk(${cmyk[0]}, ${cmyk[1]}, ${cmyk[2]}, ${cmyk[3]})`;
        }
        default:
            return "";
    }
}

// 改变颜色文字和样式
function clipColorText(l: typeof theColor, type: string) {
    const color = Color.rgb(l);
    const clipColorTextColor = color.alpha() === 1 ? (color.isLight() ? "#000" : "#fff") : "";
    theTextColor = [color.hexa(), clipColorTextColor];

    (<HTMLDivElement>document.querySelector("#clip_copy > div > div:not(:nth-child(1))")).style.backgroundColor =
        color.hexa();
    const mainEl = <HTMLElement>(
        document.querySelector(`#clip_copy > div > div:not(:nth-child(1)) > div:nth-child(${取色器格式位置})`)
    );
    // 只改变默认格式的字体颜色和内容，并定位展示
    mainEl.style.color = theTextColor[1];
    mainEl.innerText = colorConversion(theColor, type);
    if (color.alpha() !== 1) {
        mainEl.style.color = "";
    }
    (<HTMLDivElement>document.querySelector("#clip_copy > div")).style.top = `${-32 * 取色器格式位置}px`;
}

// 改变鼠标跟随栏形态，展示所有颜色格式
function changeRightBar(v) {
    // 拼接坐标和颜色代码
    let t = `<div>${finalRect[2]} × ${finalRect[3]}</div>`;
    t += `<div style="background-color:${theTextColor[0]};color:${theTextColor[1]}">`;
    for (const i in allColorFormat) {
        t += `<div>${colorConversion(theColor, allColorFormat[i])}</div>`;
    }
    document.querySelector("#clip_copy > div").innerHTML = `${t}</div>`;
    // 复制大小和颜色
    (<HTMLElement>document.querySelector("#clip_copy > div > div:nth-child(1)")).onclick = () => {
        copy(document.querySelector("#clip_copy > div > div:nth-child(1)"));
    };
    const nodes = document.querySelectorAll("#clip_copy > div > div:not(:nth-child(1)) > div");
    nodes.forEach((element: HTMLElement) => {
        ((e) => {
            e.onclick = () => {
                copy(e);
            };
        })(element);
    });
    if (v) {
        document.getElementById("point_color").style.height = "0";
        document.getElementById("clip_copy").className = "clip_copy";
        document.getElementById("mouse_bar").style.pointerEvents = "auto";
    } else {
        document.getElementById("clip_copy").className = "clip_copy_h";
        document.getElementById("point_color").style.height = "";
        document.getElementById("mouse_bar").style.pointerEvents = "none";
    }
}

/**
 * 复制内容
 * @param e 要复制内容的元素
 */
function copy(e: HTMLElement) {
    clipboard.writeText(e.innerText);
    rightKey = false;
    changeRightBar(false);
}

/**
 * 工具栏自动跟随
 * @param x x坐标
 * @param y y坐标
 */
function followBar(x?: number, y?: number) {
    const zx = (finalRect[0] + editorP.x) * editorP.zoom;
    const zy = (finalRect[1] + editorP.y) * editorP.zoom;
    const zw = finalRect[2] * editorP.zoom;
    const zh = finalRect[3] * editorP.zoom;
    if (!x && !y) {
        const dx = undoStack.at(-1)[0] - undoStack[undoStack.length - 2][0];
        const dy = undoStack.at(-1)[1] - undoStack[undoStack.length - 2][1];
        x = followBarList.at(-1)[0] + dx / ratio;
        y = followBarList.at(-1)[1] + dy / ratio;
    }
    followBarList.push([x, y]);
    const [x1, y1] = [zx, zy];
    const x2 = x1 + zw;
    const y2 = y1 + zh;
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;
    const toolW = toolBar.offsetWidth;
    const drawW = drawBar.offsetWidth;
    const gap = barGap;
    const groupW = toolW + gap + drawW;

    if ((x1 + x2) / 2 <= x) {
        // 向右
        if (x2 + groupW + gap <= maxWidth) {
            toolBar.style.left = `${x2 + gap}px`; // 贴右边
            drawBarPosi = "right";
        } else {
            if (工具栏跟随 === "展示内容优先") {
                // 超出屏幕贴左边
                if (x1 - groupW - gap >= 0) {
                    toolBar.style.left = `${x1 - toolW - gap}px`;
                    drawBarPosi = "left";
                } else {
                    // 还超贴右内
                    toolBar.style.left = `${maxWidth - groupW}px`;
                    drawBarPosi = "right";
                }
            } else {
                // 直接贴右边,即使遮挡
                toolBar.style.left = `${x2 - groupW - gap}px`;
                drawBarPosi = "right";
            }
        }
    } else {
        // 向左
        if (x1 - groupW - gap >= 0) {
            toolBar.style.left = `${x1 - toolW - gap}px`; // 贴左边
            drawBarPosi = "left";
        } else {
            if (工具栏跟随 === "展示内容优先") {
                // 超出屏幕贴右边
                if (x2 + groupW <= maxWidth) {
                    toolBar.style.left = `${x2 + gap}px`;
                    drawBarPosi = "right";
                } else {
                    // 还超贴左内
                    toolBar.style.left = `${0 + drawW + gap}px`;
                    drawBarPosi = "left";
                }
            } else {
                toolBar.style.left = `${x1 + gap}px`;
                drawBarPosi = "left";
            }
        }
    }

    if (y >= (y1 + y2) / 2) {
        if (y2 - toolBar.offsetHeight >= 0) {
            toolBar.style.top = `${y2 - toolBar.offsetHeight}px`;
        } else {
            if (y1 + toolBar.offsetHeight > maxHeight) {
                toolBar.style.top = `${maxHeight - toolBar.offsetHeight}px`;
            } else {
                toolBar.style.top = `${y1}px`;
            }
        }
    } else {
        if (y1 + toolBar.offsetHeight <= maxHeight) {
            toolBar.style.top = `${y1}px`;
        } else {
            toolBar.style.top = `${maxHeight - toolBar.offsetHeight}px`;
        }
    }
    drawBar.style.opacity = toolBar.style.opacity = "1";
    trackLocation();
}

// 修复final_rect负数
// 超出屏幕处理
function finalRectFix() {
    finalRect = finalRect.map((i) => Math.round(i)) as rect;
    const x0 = finalRect[0];
    const y0 = finalRect[1];
    const x1 = finalRect[0] + finalRect[2];
    const y1 = finalRect[1] + finalRect[3];
    let x = Math.min(x0, x1);
    let y = Math.min(y0, y1);
    let w = Math.max(x0, x1) - x;
    let h = Math.max(y0, y1) - y;
    // 移出去移回来保持原来大小
    if (x < 0) w = x = 0;
    if (y < 0) h = y = 0;
    if (x > mainCanvas.width) x = x % mainCanvas.width;
    if (y > mainCanvas.height) y = y % mainCanvas.height;
    if (x + w > mainCanvas.width) w = mainCanvas.width - x;
    if (y + h > mainCanvas.height) h = mainCanvas.height - y;
    finalRect = [x, y, w, h];
}

function inRange(min: number, value: number, max: number, type?: "[]" | "()" | "(]" | "[)") {
    if (!type) type = "[]";
    if (type === "[]") return min <= value && value <= max;
    if (type === "(]") return min < value && value <= max;
    if (type === "[)") return min <= value && value < max;
    return min < value && value < max;
}

/**
 * 判断光标位置并更改样式,定义光标位置的移动方向
 */
function isInClipRect(p: editor_position) {
    let inRect = false;
    const [canvasX, canvasY] = pXY2cXY(clipCanvas, p.x, p.y, p.x, p.y);
    p.x = canvasX;
    p.y = canvasY;

    const [x0, y0, width, height] = finalRect;
    const x1 = x0 + width;
    const y1 = y0 + height;
    // 如果全屏,那允许框选
    if (!(finalRect[2] === mainCanvas.width && finalRect[3] === mainCanvas.height)) {
        if (x0 <= p.x && p.x <= x1 && y0 <= p.y && p.y <= y1) {
            // 在框选区域内,不可框选,只可调整
            inRect = true;
        } else {
            inRect = false;
        }

        direction = "";

        const num = 8;

        // 光标样式
        if (inRange(x0, p.x, x0 + num) && inRange(y0, p.y, y0 + num)) {
            clipCanvas.style.cursor = "nwse-resize";
            direction = "西北";
        } else if (inRange(x1 - num, p.x, x1) && inRange(y1 - num, p.y, y1)) {
            clipCanvas.style.cursor = "nwse-resize";
            direction = "东南";
        } else if (inRange(y0, p.y, y0 + num) && inRange(x1 - num, p.x, x1)) {
            clipCanvas.style.cursor = "nesw-resize";
            direction = "东北";
        } else if (inRange(y1 - num, p.y, y1) && inRange(x0, p.x, x0 + num)) {
            clipCanvas.style.cursor = "nesw-resize";
            direction = "西南";
        } else if (inRange(x0, p.x, x0 + num) && inRange(y0, p.y, y1)) {
            clipCanvas.style.cursor = "ew-resize";
            direction = "西";
        } else if (inRange(x1 - num, p.x, x1) && inRange(y0, p.y, y1)) {
            clipCanvas.style.cursor = "ew-resize";
            direction = "东";
        } else if (inRange(y0, p.y, y0 + num) && inRange(x0, p.x, x1)) {
            clipCanvas.style.cursor = "ns-resize";
            direction = "北";
        } else if (inRange(y1 - num, p.y, y1) && inRange(x0, p.x, x1)) {
            clipCanvas.style.cursor = "ns-resize";
            direction = "南";
        } else if (inRange(x0 + num, p.x, x1 - num, "()") && inRange(y0 + num, p.y, y1 - num, "()")) {
            clipCanvas.style.cursor = "move";
            direction = "move";
        } else {
            clipCanvas.style.cursor = "crosshair";
            direction = "";
        }
    } else {
        // 全屏可框选
        clipCanvas.style.cursor = "crosshair";
        direction = "";
        inRect = false;
    }
    return inRect;
}

/** 调整框选 */
function moveRect(oldFinalRect: rect, oldPosition: editor_position, position: editor_position) {
    const op = pXY2cXY(clipCanvas, oldPosition.x, oldPosition.y, oldPosition.x, oldPosition.y);
    const p = pXY2cXY(clipCanvas, position.x, position.y, position.x, position.y);
    const dx = p[0] - op[0];
    const dy = p[1] - op[1];
    switch (direction) {
        case "西北":
            finalRect = [oldFinalRect[0] + dx, oldFinalRect[1] + dy, oldFinalRect[2] - dx, oldFinalRect[3] - dy];
            break;
        case "东南":
            finalRect = [oldFinalRect[0], oldFinalRect[1], oldFinalRect[2] + dx, oldFinalRect[3] + dy];
            break;
        case "东北":
            finalRect = [oldFinalRect[0], oldFinalRect[1] + dy, oldFinalRect[2] + dx, oldFinalRect[3] - dy];
            break;
        case "西南":
            finalRect = [oldFinalRect[0] + dx, oldFinalRect[1], oldFinalRect[2] - dx, oldFinalRect[3] + dy];
            break;
        case "西":
            finalRect = [oldFinalRect[0] + dx, oldFinalRect[1], oldFinalRect[2] - dx, oldFinalRect[3]];
            break;
        case "东":
            finalRect = [oldFinalRect[0], oldFinalRect[1], oldFinalRect[2] + dx, oldFinalRect[3]];
            break;
        case "北":
            finalRect = [oldFinalRect[0], oldFinalRect[1] + dy, oldFinalRect[2], oldFinalRect[3] - dy];
            break;
        case "南":
            finalRect = [oldFinalRect[0], oldFinalRect[1], oldFinalRect[2], oldFinalRect[3] + dy];
            break;
        case "move":
            finalRect = [oldFinalRect[0] + dx, oldFinalRect[1] + dy, oldFinalRect[2], oldFinalRect[3]];
            break;
    }
    if (finalRect[0] < 0) {
        finalRect[2] = finalRect[2] + finalRect[0];
        finalRect[0] = 0;
    }
    if (finalRect[1] < 0) {
        finalRect[3] = finalRect[3] + finalRect[1];
        finalRect[1] = 0;
    }
    if (finalRect[0] + finalRect[2] > mainCanvas.width) finalRect[2] = mainCanvas.width - finalRect[0];
    if (finalRect[1] + finalRect[3] > mainCanvas.height) finalRect[3] = mainCanvas.height - finalRect[1];

    finalRectFix();
    drawClipRect();
}
function isPointInPolygon(p: point): boolean {
    let inside = false;

    inside = clipCtx.isPointInPath(p.x, p.y);

    if (inside) {
        clipCanvas.style.cursor = "move";
        direction = "move";
    } else {
        clipCanvas.style.cursor = "crosshair";
        direction = "";
    }
    return inside;
}

/** 调整框选 */
function movePoly(oldPoly: point[], oldPosition: editor_position, position: editor_position) {
    const op = pXY2cXY2(clipCanvas, oldPosition.x, oldPosition.y);
    const p = pXY2cXY2(clipCanvas, position.x, position.y);
    const dx = p.x - op.x;
    const dy = p.y - op.y;
    if (direction === "move") {
        freeSelect = oldPoly.map((i) => {
            const x = Math.round(i.x + dx);
            const y = Math.round(i.y + dy);
            return { x, y };
        });

        drawClipPoly(freeSelect);
    }
}

/**
 * 保存历史
 */
function hisPush() {
    // 撤回到中途编辑，复制撤回的这一位置参数与编辑的参数一起放到末尾
    if (undoStackI !== undoStack.length - 1 && undoStack.length >= 2) undoStack.push(undoStack[undoStackI]);

    const finalRectV = [finalRect[0], finalRect[1], finalRect[2], finalRect[3]] as rect; // 防止引用源地址导致后续操作-2个被改变
    const canvas = fabricCanvas?.toJSON() || {};

    if (`${rectStack.at(-1)}` !== `${finalRectV}`) rectStack.push(finalRectV);
    if (JSON.stringify(canvasStack.at(-1)) !== JSON.stringify(canvas)) canvasStack.push(canvas);

    undoStack.push({ rect: rectStack.length - 1, canvas: canvasStack.length - 1 });
    undoStackI = undoStack.length - 1;
}
/**
 * 更改历史指针
 * @param {boolean} v true向前 false向后
 */
function undo(v: boolean) {
    if (v) {
        if (undoStackI > 0) {
            undoStackI--;
        }
    } else {
        if (undoStackI < undoStack.length - 1) {
            undoStackI++;
        }
    }
    const c = undoStack[undoStackI];
    finalRect = rectStack[c.rect];
    drawClipRect();
    followBar();
    if (fabricCanvas) fabricCanvas.loadFromJSON(canvasStack[c.canvas]);
}

function setEditType<T extends keyof EditType>(mainType: T, type: EditType[T]): void {
    if (!(mainType === "select" && type === "draw")) {
        editType[mainType] = type;
        nowType = mainType;
    }

    const SELECT = "select";

    for (const i in drawMainEls) {
        if (i === mainType) {
            drawMainEls[mainType].classList.add(SELECT);
            drawMainEls[mainType].innerHTML = drawSideEls[mainType][type].innerHTML;
        } else {
            drawMainEls[i]?.classList?.remove(SELECT);
        }
        for (const j in drawSideEls[i]) {
            if (i === mainType && j === type) {
                drawSideEls[i][j]?.classList?.add(SELECT);
            } else {
                drawSideEls[i][j]?.classList?.remove(SELECT);
            }
        }
    }

    if (mainType === "select") {
        if (type !== "draw") {
            exitFree();
            exitShape();
            exitFilter();
            drawM(false);
            if (type === "free") {
                isRect = false;
            } else {
                isRect = true;
            }
        } else {
            drawM(true);
            exitFree();
            exitShape();
            exitFilter();
        }
        backHotkeyScope();
    } else {
        drawM(true);
        toHotkeyScope("drawing");
    }
    if (mainType === "draw") {
        fabricCanvas.isDrawingMode = true;
        mode = type as EditType["draw"];
        freeInit();
        if (type === "free") {
            pencilElClick();
        }
        if (type === "eraser") {
            eraserElClick();
        }
        if (type === "spray") {
            freeSprayElClick();
        }
        exitShape();
        exitFilter();
        freeDrawCursor();
        ableChangeColor();
    }
    if (mainType === "filter") {
        willFilter = type;
        exitFree();
        exitShape();
        newFilterSelecting = true;
        fabricCanvas.defaultCursor = "crosshair";
    }
    if (mainType === "shape") {
        shape = type as Shape;
        if (shape)
            shapePro[shape] = {
                fc: fillColor,
                sc: strokeColor,
                sw: strokeWidth,
            };
        if (shape && store.get(`图像编辑.形状属性.${shape}`)) {
            const f = store.get(`图像编辑.形状属性.${shape}.fc`);
            const s = store.get(`图像编辑.形状属性.${shape}.sc`);
            const op = {};
            if (f) {
                op.fill = f;
                shapePro[shape].fc = f;
            }
            if (s) {
                op.stroke = s;
                shapePro[shape].sc = s;
            }
            colorFillEl.sv(shapePro[shape].fc);
            colorStrokeEl.sv(shapePro[shape].sc);
            const sw = store.get(`图像编辑.形状属性.${shape}.sw`);
            if (sw) {
                shapePro[shape].sw = sw;
                (<HTMLInputElement>document.querySelector("#draw_stroke_width > range-b")).value = sw;
            }
        }

        exitFree();
        exitFilter();
        fabricCanvas.defaultCursor = "crosshair";

        ableChangeColor();
    }

    if (!(mainType === "select" && type === "draw")) store.set(`图像编辑.记忆.${mainType}`, type);

    setOnlyStroke(mainType === "draw" || (mainType === "shape" && strokeShapes.includes(type)));
}

function showSideBarItem(index: number) {
    const sises = [1, 1, 2, 3, 1, 1, 1];
    showSideBar(true);
    document.querySelectorAll("#draw_side > div").forEach((el: HTMLElement, i) => {
        if (index === i) {
            el.style.display = "";
            const height = Math.ceil(el.children.length / sises[index]);
            const x = sises[index];
            const y = height;
            el.style.width = `${x * bSize}px`;
            let left = bSize * 1;
            if (drawBar.offsetLeft + bSize + bSize * x > window.innerWidth) left = -bSize * x;
            drawSideBar.style.left = `${left}px`;
            drawSideBar.style.top = `${bSize * Math.min(i, drawMainBar.children.length - y)}px`;
            drawSideBar.style.width = `${bSize * x}px`;
            drawSideBar.style.height = `${bSize * y}px`;
        } else {
            el.style.display = "none";
        }
    });
}

function isInDrawBar() {
    return drawBar.contains(document.elementFromPoint(nowMouseE.clientX, nowMouseE.clientY));
}

function showSideBar(show: boolean) {
    if (show) {
        drawSideBar.classList.remove("draw_side_hide");
    } else {
        drawSideBar.classList.add("draw_side_hide");
    }
}

function showBars(b: boolean) {
    const l = [toolBar, drawBar];
    for (const i of l) {
        if (b) {
            i.style.pointerEvents = "";
            i.style.opacity = "";
        } else {
            i.style.pointerEvents = "none";
            i.style.opacity = "0";
        }
    }
}
function pencilElClick() {
    fabricCanvas.freeDrawingBrush = new Fabric.PencilBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.color = freeColor;
    fabricCanvas.freeDrawingBrush.width = freeWidth;

    setDrawMode("stroke");

    freeShadow();
}
function eraserElClick() {
    fabricCanvas.freeDrawingBrush = new Fabric.EraserBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.width = freeWidth;
}
function freeSprayElClick() {
    fabricCanvas.freeDrawingBrush = new Fabric.SprayBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.color = freeColor;
    fabricCanvas.freeDrawingBrush.width = freeWidth;

    setDrawMode("stroke");
}
function freeShadow() {
    const shadowBlur = Number((<HTMLInputElement>document.querySelector("#shadow_blur > range-b")).value);
    fabricCanvas.freeDrawingBrush.shadow = new Fabric.Shadow({
        blur: shadowBlur,
        color: freeColor,
    });
    store.set(`图像编辑.形状属性.${mode}.shadow`, shadowBlur);
}

function freeDrawCursor() {
    if (mode === "free" || mode === "eraser") {
        let svgW = freeWidth;
        let hW = svgW / 2;
        const r = freeWidth / 2;
        if (svgW < 10) {
            svgW = 10;
            hW = 5;
        }
        let svg = "";
        if (mode === "free") {
            svg = `<svg width="${svgW}" height="${svgW}" xmlns="http://www.w3.org/2000/svg"><line x1="0" x2="${svgW}" y1="${hW}" y2="${hW}" stroke="#000"/><line y1="0" y2="${svgW}" x1="${hW}" x2="${hW}" stroke="#000"/><circle style="fill:${freeColor};" cx="${hW}" cy="${hW}" r="${r}"/></svg>`;
        } else {
            svg = `<svg width="${svgW}" height="${svgW}" xmlns="http://www.w3.org/2000/svg"><line x1="0" x2="${svgW}" y1="${hW}" y2="${hW}" stroke="#000"/><line y1="0" y2="${svgW}" x1="${hW}" x2="${hW}" stroke="#000"/><circle style="stroke-width:1;stroke:#000;fill:none" cx="${hW}" cy="${hW}" r="${r}"/></svg>`;
        }
        const d = document.createElement("div");
        d.innerHTML = svg;
        const s = new XMLSerializer().serializeToString(d.querySelector("svg"));
        const cursorUrl = `data:image/svg+xml;base64,${window.btoa(s)}`;
        fabricCanvas.freeDrawingCursor = `url(" ${cursorUrl} ") ${hW} ${hW}, auto`;
    } else {
        fabricCanvas.freeDrawingCursor = "auto";
    }
}

function freeInit() {
    const sc = store.get(`图像编辑.形状属性.${mode}.sc`);
    const sw = store.get(`图像编辑.形状属性.${mode}.sw`);
    const sb = store.get(`图像编辑.形状属性.${mode}.shadow`);
    if (!shapePro[mode]) shapePro[mode] = {};
    if (sc) shapePro[mode].sc = sc;
    if (sw) shapePro[mode].sw = sw;
    if (sb) shapePro[mode].shadow = sb;
    setDrawMode("stroke");
    if (sc) colorStrokeEl.sv(sc);
    if (sw) (<HTMLInputElement>document.querySelector("#draw_stroke_width > range-b")).value = sw;
    if (sb) (<HTMLInputElement>document.querySelector("#shadow_blur > range-b")).value = sb;
}

function fabricDelete() {
    for (const o of fabricCanvas.getActiveObject()._objects || [fabricCanvas.getActiveObject()]) {
        fabricCanvas.remove(o);
    }
    getFObjectV();
    getFilters();
    hisPush();
}

function rotate(x: number, y: number, r: number) {
    const s = Math.sin(r);
    const c = Math.cos(r);
    return [x * c - y * s, x * s + y * c];
}

// 画一般图形
function draw(shape: EditType["shape"], v: "start" | "move", x1: number, y1: number, x2: number, y2: number) {
    const pro = shapePro[shape];
    const [fillColor, strokeColor, strokeWidth] = [pro.fc, pro.sc, pro.sw];
    if (v === "move") {
        fabricCanvas.remove(shapes.at(-1));
        shapes.splice(shapes.length - 1, 1);
    }
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x1 - x2);
    const h = Math.abs(y1 - y2);
    if (shape === "line") {
        shapes[shapes.length] = new Fabric.Line([x1, y1, x2, y2], {
            stroke: strokeColor,
            形状: "line",
        });
    } else if (shape === "circle") {
        shapes[shapes.length] = new Fabric.Circle({
            radius: Math.max(w, h) / 2,
            left: x,
            top: y,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            canChangeFill: true,
            形状: "circle",
        });
    } else if (shape === "rect") {
        shapes[shapes.length] = new Fabric.Rect({
            left: x,
            top: y,
            width: w,
            height: h,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            canChangeFill: true,
            形状: "rect",
        });
    } else if (shape === "text") {
        shapes.push(
            new Fabric.IText("点击输入文字", {
                left: x,
                top: y,
                canChangeFill: true,
                形状: "text",
                fontFamily: 字体.主要字体,
            })
        );
    } else if (shape === "arrow") {
        const line = new Fabric.arrow([x1, y1, x2, y2], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            形状: "arrow",
        });
        shapes.push(line);
    } else if (shape === "mask") {
        shapes.push(
            new mask({
                left: 0,
                top: 0,
                width: fabricCanvas.width,
                height: fabricCanvas.height,
                fill: fillColor,
                rect: { x, y, w, h },
                canChangeFill: true,
                形状: "mask",
            })
        );
    }
    fabricCanvas.add(shapes.at(-1));
}
// 多边形
function drawPoly(shape: EditType["shape"]) {
    console.log(1111);

    const pro = shapePro[shape];
    const [fillColor, strokeColor, strokeWidth] = [pro.fc, pro.sc, pro.sw];
    if (polyOP.length !== 1) {
        fabricCanvas.remove(shapes.at(-1));
        shapes.splice(shapes.length - 1, 1);
    }
    if (shape === "polyline") {
        shapes.push(
            new Fabric.Polyline(polyOP, {
                fill: "#0000",
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                形状: "polyline",
            })
        );
    }
    if (shape === "polygon") {
        shapes.push(
            new Fabric.Polygon(polyOP, {
                fill: fillColor,
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                canChangeFill: true,
                形状: "polygon",
            })
        );
    }
    fabricCanvas.add(shapes.at(-1));
}

function drawNumber() {
    drawNumberN = Number(shapes?.at(-1)?.text) + 1 || drawNumberN;
    const p = polyOP.at(-1);

    const txt = new Fabric.number({
        left: p.x,
        top: p.y,
        fontSize: 16,
        radius: 12,
        originX: "center",
        originY: "center",
        fill: shapePro.number.fc,
        stroke: shapePro.number.sc,
        strokeWidth: shapePro.number.sw,
        canChangeFill: true,
        text: String(drawNumberN),
        形状: "number",
    });
    shapes.push(txt);
    fabricCanvas.add(shapes.at(-1));
    fabricCanvas.setActiveObject(txt);

    drawNumberN++;
}

/** 切换当前颜色设定的ui */
function setDrawMode(m: typeof colorM) {
    colorM = m;
    if (m === "fill") {
        colorFillEl.style({ height: "" });
        colorStrokeEl.style({ height: "0" });
        document.getElementById("draw_stroke_width").style.height = "0";
        document.getElementById("draw_fill_storke_mark").style.top = "0";
        document.getElementById("draw_fill_storke_mark").title = "当前为填充";
    } else {
        colorFillEl.style({ height: "0" });
        colorStrokeEl.style({ height: "" });
        document.getElementById("draw_stroke_width").style.height = "";
        document.getElementById("draw_fill_storke_mark").style.top = "calc(var(--bar-size) / 2)";
        document.getElementById("draw_fill_storke_mark").title = "当前为描边";
    }
}

function ableChangeColor() {
    if (fabricCanvas.isDrawingMode || shape || fabricCanvas.getActiveObject()) {
        drawItemsEl.style.pointerEvents = "auto";
        drawItemsEl.style.opacity = "1";
    } else {
        drawItemsEl.style.pointerEvents = "none";
        drawItemsEl.style.opacity = "0.2";
    }
}

function colorInput(type: "fill" | "stroke") {
    const i = input("color").on("input", () => {
        setC();
        main.el.dispatchEvent(new Event("input"));
    });
    const alpha = ele("input") // todo range-b
        .attr({ type: "number", max: "1", min: "0", step: "0.01" })
        .on("input", () => {
            setC();
            main.el.dispatchEvent(new Event("input"));
        });
    function getInputV() {
        return Color(i.gv()).alpha(Number(alpha.el.value));
    }
    function setC() {
        const color = getInputV();
        i.style({ "background-color": color.hexa() });

        let textColor = "#000";
        const tColor = color;
        const bgColor = Color(getComputedStyle(document.documentElement).getPropertyValue("--bar-bg").replace(" ", ""));
        if (tColor.alpha() >= 0.5 || tColor.alpha() === undefined) {
            if (tColor.isLight()) {
                textColor = "#000";
            } else {
                textColor = "#fff";
            }
        } else {
            // 低透明度背景呈现栏的颜色
            if (bgColor.isLight()) {
                textColor = "#000";
            } else {
                textColor = "#fff";
            }
        }
        i.style({ color: textColor });

        const mainSideBarEl = <HTMLDivElement>document.querySelector("#draw_color > div");
        if (type === "fill") {
            mainSideBarEl.style.backgroundColor = color.hexa();
        }
        if (type === "stroke") {
            mainSideBarEl.style.borderColor = color.hexa();
        }
    }
    const main = view()
        .add([i, alpha])
        .bindSet((v: string) => {
            const color = Color(v);
            i.sv(color.hex());
            alpha.el.value = String(color.alpha());
            setC();
        })
        .bindGet(() => {
            return getInputV().hexa();
        });
    return main;
}

/** 主编辑栏的属性预览显示为描边 */
function setOnlyStroke(b: boolean) {
    const el = <HTMLDivElement>document.querySelector("#draw_color > div");
    if (b) {
        el.style.width = "0";
        el.style.rotate = "45deg";
    } else {
        el.style.width = "";
        el.style.rotate = "";
    }
    setDrawMode(b ? "stroke" : "fill");
}

// 色盘
function colorBar() {
    // 主盘
    const colorList = ["hsl(0, 0%, 100%)"];
    const baseColor = Color("hsl(0, 100%, 50%)");
    for (let i = 0; i < 360; i += 15) {
        colorList.push(baseColor.rotate(i).string());
    }
    let isNext = false;
    showColor();
    // 下一层级
    function nextColor(h: string) {
        let nextColorList = [];
        if (h === "hsl(0, 0%, 100%)") {
            for (let i = 0; i < 25; i++) {
                const x = (100 / 24) * (24 - i);
                nextColorList.push(`hsl(0, 0%, ${x}%)`);
            }
        } else {
            const _h = Number(h.match(/hsl\(([0-9]*)/)[1]);
            for (let i = 90; i > 0; i -= 20) {
                for (let j = 100; j > 0; j -= 20) {
                    nextColorList.push(`hsl(${_h}, ${j}%, ${i}%)`);
                }
            }
        }
        let tt = "";
        for (const n in nextColorList) {
            tt += `<div class="color_i" style="background-color: ${nextColorList[n]}" title="${colorConversion(
                nextColorList[n],
                取色器默认格式
            )}"></div>`;
        }
        document.querySelector("#draw_color_color").innerHTML = tt;
        nextColorList = tt = null;
    }
    function showColor() {
        let t = "";
        for (const i in colorList) {
            const x = colorList[i];
            t += `<div class="color_i" style="background-color: ${x}" title="${colorConversion(
                x,
                取色器默认格式
            )}" data-i="${i}"></div>`;
        }
        document.querySelector("#draw_color_color").innerHTML = t;
        t = null;
    }
    // 事件
    function cColor(el: HTMLElement) {
        const color = el.style.backgroundColor;
        if (colorM === "fill") {
            colorFillEl.sv(color);
            setFObjectV(color, null, null);
        }
        if (colorM === "stroke") {
            colorStrokeEl.sv(color);
            setFObjectV(null, color, null);
        }
    }
    document.getElementById("draw_color_color").onpointerdown = (e) => {
        const el = e.target as HTMLElement;
        if (e.button === 0) {
            cColor(el);
        } else {
            isNext = !isNext;
            if (isNext) {
                const index = Number(el.getAttribute("data-i"));
                nextColor(colorList[index]);
            } else {
                showColor();
            }
        }
    };
}

/** 鼠标点击后，改变栏文字样式 */
function getFObjectV() {
    let pro = { fc: fillColor, sc: strokeColor, sw: strokeWidth };
    if (fabricCanvas.getActiveObject()) {
        let n = fabricCanvas.getActiveObject();
        if (n._objects) {
            // 当线与形一起选中，确保形不会透明
            for (const i of n._objects) {
                if (i.canChangeFill) n = i;
            }
        }
        if (n.fill) pro.fc = n.fill;
        if (n.stroke) pro.sc = n.stroke;
        if (n.strokeWidth) pro.sw = n.strokeWidth;
        if (n.filters) pro = { fc: fillColor, sc: strokeColor, sw: strokeWidth };
        setOnlyStroke(!n.canChangeFill);
    } else if (fabricCanvas.isDrawingMode) {
        pro = { fc: "#0000", sc: freeColor, sw: freeWidth };
    } else {
        pro = { fc: fillColor, sc: strokeColor, sw: strokeWidth };
    }
    console.log(pro);
    (<HTMLInputElement>document.querySelector("#draw_stroke_width > range-b")).value = pro.sw;
    colorFillEl.sv(pro.fc);
    colorStrokeEl.sv(pro.sc);

    ableChangeColor();
}
/**
 * 更改全局或选中形状的颜色
 * @param {String} fill 填充颜色
 * @param {String} stroke 边框颜色
 * @param {Number} sw 边框宽度
 */
function setFObjectV(fill: string, stroke: string, sw: number) {
    if (fabricCanvas.getActiveObject()) {
        console.log(0);
        /* 选中Object */
        let n = fabricCanvas.getActiveObject(); /* 选中多个时，n下有_Object<形状>数组，1个时，n就是形状 */
        n = n._objects || [n];
        for (const i in n) {
            if (fill) {
                // 只改变形的颜色
                if (n[i].canChangeFill) n[i].set("fill", fill);
            }
            if (stroke) n[i].set("stroke", stroke);
            if (sw) n[i].set("strokeWidth", sw);
            if (n[i].形状) {
                store.set(`图像编辑.形状属性.${n[i].形状}.fc`, fill || fillColor);
                store.set(`图像编辑.形状属性.${n[i].形状}.sc`, stroke || strokeColor);
                store.set(`图像编辑.形状属性.${n[i].形状}.sw`, sw || strokeWidth);
                shapePro[n[i].形状] = {
                    fc: fill || fillColor,
                    sc: stroke || strokeColor,
                    sw: sw || strokeWidth,
                };
            }
        }
        fabricCanvas.renderAll();
    } else if (fabricCanvas.isDrawingMode) {
        console.log(1);
        /* 画笔 */
        if (stroke) fabricCanvas.freeDrawingBrush.color = shapePro[editType.draw].sc = stroke;
        if (sw) fabricCanvas.freeDrawingBrush.width = shapePro[editType.draw].sw = sw;
        freeDrawCursor();
        freeShadow();
        if (mode) {
            store.set(`图像编辑.形状属性.${mode}.sc`, stroke || strokeColor);
            store.set(`图像编辑.形状属性.${mode}.sw`, sw || strokeWidth);
        }
    } else {
        console.log(2);
        /* 非画笔非选中 */
        const pro = shapePro[editType.shape];
        if (fill) pro.fc = fill;
        if (stroke) pro.sc = stroke;
        if (sw) pro.sw = sw;
    }
}

function newFilterSelect(o, no) {
    const x1 = o.x.toFixed();
    const y1 = o.y.toFixed();
    const x2 = no.x.toFixed();
    const y2 = no.y.toFixed();
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x1 - x2);
    const h = Math.abs(y1 - y2);

    const mainCtx = mainCanvas.getContext("2d");
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = w;
    tmpCanvas.height = h;
    const gid = mainCtx.getImageData(x, y, w, h); // 裁剪
    tmpCanvas.getContext("2d").putImageData(gid, 0, 0);
    const img = new Fabric.Image(tmpCanvas, {
        left: x,
        top: y,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hasControls: false,
        hoverCursor: "auto",
    });
    fabricCanvas.add(img);
    fabricCanvas.setActiveObject(img);
}

function applyFilter(i: number, filter) {
    const obj = fabricCanvas.getActiveObject();
    obj.filters[i] = filter;
    obj.applyFilters();
    fabricCanvas.renderAll();
}
function getFilters() {
    if (!fabricCanvas.getActiveObject()?.filters) return;
    const f = fabricCanvas.getActiveObject().filters;

    for (const fl of Object.values(filtetMap)) {
        if (fl.value) {
            if (f[fl.i]) {
                const name = Object.keys(filtetMap).find((f) => filtetMap[f].i === fl.i);
                filterRangeEl.innerHTML = `<range-b min="${fl.value.min || 0}" max="${fl.value.max}" value="${
                    f[fl.i][fl.key]
                }" text="${fl.value.text || ""}" step="${fl.value.step || 1}"></range-b>`;
                const range = filterRangeEl.querySelector("range-b") as HTMLInputElement;
                range.oninput = () => {
                    const filter = new Fabric.Image.filters[fl.f]({
                        [fl.key]: Number(range.value),
                    });
                    applyFilter(fl.i, filter);
                };
                for (const i of Object.values(drawSideEls.filter)) {
                    i.classList.remove("filter_select");
                }
                drawSideEls.filter[name].classList.add("filter_select");
            }
        }
    }

    (<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(1)")).value = String(
        f[6]?.gamma[0] || 1
    );
    (<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(2)")).value = String(
        f[6]?.gamma[1] || 1
    );
    (<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(3)")).value = String(
        f[6]?.gamma[2] || 1
    );
    const gray = f[8]?.mode;
    switch (gray) {
        case "average":
            (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)")).checked = true;
            break;
        case "lightness":
            (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)")).checked = true;
            break;
        case "luminosity":
            (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)")).checked = true;
        default:
            (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)")).checked = false;
            (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)")).checked = false;
            (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)")).checked = false;
    }
}

// 确保退出其他需要鼠标事件的东西，以免多个东西一起出现
function exitFree() {
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.defaultCursor = "auto";
}
function exitShape() {
    shape = "";
    drawingShape = false;
    fabricCanvas.selection = true;
    fabricCanvas.defaultCursor = "auto";
    polyOP = [];
}
function exitFilter() {
    newFilterSelecting = false;
    fabricCanvas.defaultCursor = "auto";
    willFilter = "";
}

function fabricCopy() {
    const dx = store.get("图像编辑.复制偏移.x");
    const dy = store.get("图像编辑.复制偏移.y");
    fabricCanvas.getActiveObject().clone((cloned) => {
        fabricClipboard = cloned;
    });
    fabricClipboard.clone((clonedObj) => {
        fabricCanvas.discardActiveObject();
        clonedObj.set({
            left: clonedObj.left + dx,
            top: clonedObj.top + dy,
            evented: true,
        });
        if (clonedObj.type === "activeSelection") {
            clonedObj.fabric_canvas = fabricCanvas;
            clonedObj.forEachObject((obj) => {
                fabricCanvas.add(obj);
            });
            clonedObj.setCoords();
        } else {
            fabricCanvas.add(clonedObj);
        }
        fabricCanvas.setActiveObject(clonedObj);
        fabricCanvas.requestRenderAll();
    });
    hisPush();
}

// 检查应用更新

function checkUpdate(show?: boolean) {
    const version = store.get("设置版本");
    const m = store.get("更新.模式") as setting["更新"]["模式"];
    fetch("https://api.github.com/repos/xushengfeng/eSearch/releases")
        .then((v) => v.json())
        .then((re) => {
            let first;
            for (const r of re) {
                if (first) break;
                if (!version.includes("beta") && !version.includes("alpha") && m !== "dev") {
                    if (!r.draft && !r.prerelease) first = r;
                } else {
                    first = r;
                }
            }
            let update = false;
            const firstName = first.name as string;
            if (m === "dev") {
                if (firstName !== version) update = true;
            } else if (m === "小版本") {
                if (firstName.split(".").slice(0, 2).join(".") !== version.split(".").slice(0, 2).join("."))
                    update = true;
            } else {
                if (firstName.split(".").at(0) !== version.split(".").at(0)) update = true;
            }
            if (update) {
                ipcRenderer.send("clip_main_b", "new_version", { v: first.name, url: first.html_url });
            } else if (show) {
                ipcRenderer.send("clip_main_b", "new_version");
            }
        })
        .catch(() => {
            ipcRenderer.send("clip_main_b", "new_version", "err");
        });
}

// 获取设置

if (store.get("框选.自动框选.开启")) {
    var cv = require("opencv.js");
}

const 字体 = store.get("字体") as setting["字体"];

let 工具栏跟随: string;
let 光标: string;
let 四角坐标: boolean;
let 遮罩颜色: string;
let 选区颜色: string;
let 取色器默认格式: string;
let 取色器格式位置: number;
let 取色器显示: boolean;
let colorSize: number;
let colorISize: number;
let 记忆框选: boolean;
let 记忆框选值: { [id: string]: rect };
let bSize: number;
const allColorFormat = ["HEX", "RGB", "HSL", "HSV", "CMYK"];

const 全局缩放 = store.get("全局.缩放") || 1.0;
let ratio = 1;

setSetting();

const tools: 功能[] = [
    "close",
    "screens",
    "ocr",
    "search",
    "QR",
    "open",
    "ding",
    "record",
    "long",
    "translate",
    "copy",
    "save",
];

pureStyle();

const hotkeyTipEl = view().attr({ id: "hotkeys_tip" });

const toolBarEl = frame("tool", {
    _: view(),
    close: iconEl(close_svg),
    screens: view(),
    ocr: { _: iconEl(ocr_svg), ocrE: selectMenu().class("side_select") },
    search: { _: iconEl(search_svg), searchE: selectMenu().class("side_select") },
    QR: iconEl(scan_svg),
    open: iconEl(open_svg),
    ding: iconEl(ding_svg),
    record: iconEl(record_svg),
    long: iconEl(long_clip_svg),
    translate: iconEl(translate_svg),
    copy: iconEl(copy_svg),
    save: iconEl(save_svg),
});

toolBarEl.el.attr({ id: "tool_bar" });

for (const i of [
    { value: "baidu", t: "百度" },
    { value: "yandex", t: "Yandex" },
    { value: "google", t: "Google" },
]) {
    toolBarEl.els.searchE.add(ele("option").attr({ innerText: i.t, value: i.value }));
}

toolBarEl.el.style({ left: store.get("工具栏.初始位置.left"), top: store.get("工具栏.初始位置.top") });

const toolsOrder = store.get("工具栏.功能") as string[];
for (const g of tools) {
    const id = g;
    const i = toolsOrder.indexOf(id);
    const el = toolBarEl.els[id];
    if (i !== -1) el.style({ order: String(i) });
    else el.style({ display: "none" });
}

const whEl = view().attr({ id: "clip_wh" });
const whX0 = input("x0");
const whY0 = input("y0");
const whX1 = input("x1");
const whY1 = input("y1");
const whW = input("w");
const whH = input("h");
const whXYStyle = { display: 四角坐标 ? "block" : "none" };
whEl.add([
    view()
        .style(whXYStyle)
        .add([whX0, txt(", "), whY0]),
    view()
        .style(whXYStyle)
        .add([whX1, txt(", "), whY1]),
    view().add([whW, txt(" × "), whH]),
]);

const longTip = frame("long_tip", {
    _: view().attr({ id: "long_tip" }),
    rect: { _: view().attr({ id: "long_rect" }), finish: view().attr({ id: "long_finish" }) },
});

const longPreview = view().style({ position: "fixed" });

document.body.append(hotkeyTipEl.el);
document.body.append(toolBarEl.el.el);
document.body.append(whEl.el);
document.body.append(longTip.el.el);
document.body.append(longPreview.el);

const colorFillEl = colorInput("fill").on("input", () => {
    setFObjectV(colorFillEl.gv() as string, null, null);
});
const colorStrokeEl = colorInput("stroke").on("input", () => {
    setFObjectV(colorStrokeEl.gv() as string, null, null);
});

elFromId("draw_color_p").add([colorFillEl, colorStrokeEl]);

const editor = document.getElementById("editor");
editor.style.width = `${window.screen.width / 全局缩放}px`;
const mainCanvas = <HTMLCanvasElement>document.getElementById("main_photo");
const clipCanvas = <HTMLCanvasElement>document.getElementById("clip_photo");
const drawCanvas = <HTMLCanvasElement>document.getElementById("draw_photo");
// 第一次截的一定是桌面,所以可提前定义
mainCanvas.width = clipCanvas.width = drawCanvas.width = window.screen.width * window.devicePixelRatio;
mainCanvas.height = clipCanvas.height = drawCanvas.height = window.screen.height * window.devicePixelRatio;
let zoomW = 0;
type rect = [number, number, number, number];
type point = { x: number; y: number };
let finalRect = [0, 0, mainCanvas.width, mainCanvas.height] as rect;
let freeSelect: point[] = [];
const screenPosition: { [key: string]: { x: number; y: number } } = {};

const toolBar = toolBarEl.el.el;
const drawBar = document.getElementById("draw_bar");

let nowScreenId = 0;

let allScreens: (Electron.Display & { captureSync?: () => Buffer; image?: Buffer })[] = [];

let nowMouseE: MouseEvent = null;

const editorP = { zoom: 1, x: 0, y: 0 };

let middleB: PointerEvent;
const middleP = { x: 0, y: 0 };

const edgeRect: { x: number; y: number; width: number; height: number; type: "system" | "image" }[] = [];

let centerBarShow = false;
let centerBarM = null;

const tool = {
    close: () => closeWin(),
    ocr: () => runOcr(),
    search: () => runSearch(),
    QR: () => runQr(),
    open: () => openApp(),
    record: () => initRecord(),
    long: () => startLong(),
    translate: () => translate(),
    // 钉在屏幕上
    ding: () => runDing(),
    // 复制
    copy: () => runCopy(),
    save: () => runSave(),
};

const drawMainEls: { [key in keyof EditType]: HTMLElement } = {
    select: document.getElementById("draw_select"),
    draw: document.getElementById("draw_free"),
    shape: document.getElementById("draw_shapes"),
    filter: document.getElementById("draw_filters"),
};
const shapeEl = {} as { [key in EditType["shape"]]: HTMLElement };
const filtersEl = {} as { [key in EditType["filter"]]: HTMLElement };
const drawSideEls: { [key in keyof EditType]: { [key1 in EditType[key]]: HTMLElement } } = {
    select: {
        rect: document.getElementById("draw_select_rect"),
        free: document.getElementById("draw_select_free"),
        draw: document.getElementById("draw_select_draw"),
    },
    draw: {
        free: document.getElementById("draw_free_pencil"),
        eraser: document.getElementById("draw_free_eraser"),
        spray: document.getElementById("draw_free_spray"),
    },
    filter: filtersEl,
    shape: shapeEl,
};

type hotkeyScope = "normal" | "c_bar" | "drawing";
const hotkeyScopes: hotkeyScope[] = [];

const toolList: 功能[] = ["close", "screens", "ocr", "search", "QR", "open", "ding", "record", "long", "copy", "save"];

const drawHotKey: setting["截屏编辑快捷键"] = store.get("截屏编辑快捷键");

const canvasControlKey = {
    操作_撤回: "Control+Z",
    操作_重做: "Control+Y",
    操作_复制: "Control+C",
    操作_删除: "Delete",
};

type hotkeyTip = { name: string; keys: string[] }[];
const hotkeyTipX: { name: string; hotkey: hotkeyTip }[] = [
    {
        name: "画布",
        hotkey: [
            { name: "移动", keys: ["方向键", "wheel"] },
            { name: "缩放", keys: ["Control+wheel"] },
        ],
    },
    {
        name: "框选",
        hotkey: [
            { name: "全选", keys: ["Control+A"] },
            { name: "移动和调节", keys: ["按住+方向键"] },
            { name: "×5", keys: ["+Control+"] },
            { name: "×10", keys: ["+Shift+"] },
            { name: "左上x", keys: [store.get("大小栏快捷键.左上x")] },
            { name: "左上y", keys: [store.get("大小栏快捷键.左上y")] },
            { name: "右下x", keys: [store.get("大小栏快捷键.右下x")] },
            { name: "右下y", keys: [store.get("大小栏快捷键.右下y")] },
            { name: "宽", keys: [store.get("大小栏快捷键.宽")] },
            { name: "高", keys: [store.get("大小栏快捷键.高")] },
        ],
    },
    {
        name: "数值",
        hotkey: [
            { name: "大", keys: ["Up"] },
            { name: "小", keys: ["Down"] },
            { name: "取消更改", keys: ["RightKey"] },
        ],
    },
    {
        name: "取色器",
        hotkey: [
            { name: "展示所有颜色格式", keys: ["RightKey"] },
            { name: "复制颜色", keys: [store.get("其他快捷键.复制颜色")] },
        ],
    },
    { name: "快捷键", hotkey: [{ name: "展示", keys: ["Alt"] }] },
];

let autoDo: setting["框选后默认操作"] = store.get("框选后默认操作");

let lastLong = 0;

let uIOhook;

const longX = {
    img: null as HTMLCanvasElement,
    imgXY: { x: 0, y: 0 },
    lastImg: null as HTMLCanvasElement,
    lastXY: { x: 0, y: 0 },
};

let longRunning = false;
let longInited = false;

let type: setting["保存"]["默认格式"];

let toolPosition = { x: null, y: null };

/** 矩形还是自由 */
let isRect = true;
let /**是否在绘制新选区*/ selecting = false;
let rightKey = false;
let canvasRect = null;
let /**是否在更改选区*/ moving = false;

type editor_position = { x: number; y: number };

let /** 先前坐标，用于框选的生成和调整 */ oldP = { x: Number.NaN, y: Number.NaN } as editor_position;
let oFinalRect = null as rect;
let oPoly = null as point[];
let theColor: [number, number, number, number] = null;
let theTextColor = [null, null];
const clipCtx = clipCanvas.getContext("2d");
const undoStack = [{ rect: 0, canvas: 0 }];
const rectStack = [[0, 0, mainCanvas.width, mainCanvas.height]] as rect[];
const canvasStack = [{}];
let undoStackI = 0;
let nowCanvasPosition: number[];
let direction: "" | "move" | "东" | "西" | "南" | "北" | "东南" | "西南" | "东北" | "西北";
const autoSelectRect = store.get("框选.自动框选.开启");
const autoPhotoSelectRect = store.get("框选.自动框选.图像识别");
let /**鼠标是否移动过，用于自动框选点击判断 */ moved = false;
let /**鼠标是否按住 */ down = false;
let /**是否选好了选区，若手动选好，自动框选提示关闭 */ rectSelect = false;

let rectInRect = [];

const mouseBarW =
    Math.max(
        colorSize * colorISize,
        (String(window.innerWidth).length + String(window.innerHeight).length + 2 + 1) * 8
    ) + 4;
const mouseBarH = 4 + colorSize * colorISize + 32 * 2;

// 工具栏跟随
const followBarList = [[0, 0]];
let drawBarPosi: "right" | "left" = "right";
const barGap = 8;

// 移动画画栏
let drawBarMoving = false;
let drawBarMovingXY = [];

let nowType: keyof EditType;
const editType: EditType = {
    select: "rect",
    draw: "free",
    filter: "pixelate",
    shape: "rect",
};
const editTypeRecord = store.get("图像编辑.记忆") as EditType;

editType.select = editTypeRecord.select || editType.select;
editType.draw = editTypeRecord.draw || editType.draw;
editType.filter = editTypeRecord.filter || editType.filter;
editType.shape = editTypeRecord.shape || editType.shape;

let willShowITime: NodeJS.Timeout;

let isShowBars = !store.get("工具栏.稍后出现") as boolean;

let mode: EditType["draw"];

const strokeWidthF = {
    set: (v: number) => {
        (<HTMLInputElement>document.querySelector("#draw_stroke_width > range-b")).value = String(v);
        setFObjectV(null, null, Math.floor(v));
    },
    get: () => {
        return Number((<HTMLInputElement>document.querySelector("#draw_stroke_width > range-b")).value);
    },
};

type Shape = EditType["shape"] | "";
let shape: Shape = "";

let drawingShape = false;
const shapes = [];
const unnormalShapes = ["polyline", "polygon", "number"];
const strokeShapes = ["line", "polyline", "arrow"];
let drawOP = []; // 首次按下的点
let polyOP = []; // 多边形点
let newFilterO = null;
let drawNumberN = 1;

/** 规定当前色盘对应的是填充还是边框 */
let colorM: "fill" | "stroke" = "fill";

let newFilterSelecting = false;

const filtetMap: {
    [key in EditType["filter"]]: {
        f: string;
        i: number;
        key?: string;
        value?: {
            value: number;
            max: number;
            min?: number;
            step?: number;
            text?: string;
        };
    };
} = {
    // 马赛克
    // 在fabric源码第二个uBlocksize * uStepW改为uBlocksize * uStepH
    pixelate: { f: "Pixelate", i: 0, key: "blocksize", value: { value: 16, max: 20, text: "px" } },
    blur: { f: "Blur", i: 1, key: "blur", value: { value: 1, max: 5, text: "%", step: 0.1 } },
    brightness: { f: "Brightness", i: 2, key: "brightness", value: { min: -1, value: 0, max: 1, step: 0.01 } },
    contrast: { f: "Contrast", i: 3, key: "contrast", value: { min: -1, value: 0, max: 1, step: 0.01 } },
    saturation: { f: "Saturation", i: 4, key: "saturation", value: { min: -1, value: 0, max: 1, step: 0.01 } },
    hue: { f: "HueRotation", i: 5, key: "rotation", value: { min: -1, value: 0, max: 1, step: 0.01 } },
    noise: { f: "Noise", i: 7, value: { value: 0, max: 1000 } },
    invert: { f: "Invert", i: 9 },
    sepia: { f: "Sepia", i: 10 },
    // 黑白
    bw: { f: "BlackWhite", i: 11 },
    brownie: { f: "Brownie", i: 12 },
    vintage: { f: "Vintage", i: 13 },
    koda: { f: "Kodachrome", i: 14 },
    techni: { f: "Technicolor", i: 15 },
    polaroid: { f: "Polaroid", i: 16 },
};

let willFilter = "";

let fabricClipboard;

// ------

document.body.style.opacity = "0";

ipcRenderer.on("reflash", (_a, _displays: Electron.Display[], mainid: number, act: 功能) => {
    if (!_displays.find((i) => i.main)) {
        dispaly2screen(_displays, Screenshots.all());
    } else {
        allScreens = _displays;
    }
    console.log(allScreens);
    const mainId = mainid;
    for (const i of allScreens) {
        if (i.main || i.id === mainId) {
            if (!i.image) i.image = i.captureSync();
            setScreen(i);
            setEditorP(1 / i.scaleFactor, 0, 0);
            zoomW = i.size.width;
            ratio = i.scaleFactor;
            document.body.style.opacity = "";
        }
        screenPosition[i.id] = { x: i.bounds.x, y: i.bounds.y };
    }
    ipcRenderer.send("clip_main_b", "window-show");
    const screensEl = toolBarEl.els.screens;
    if (allScreens.length > 1) {
        let minX = 0;
        let maxX = 0;
        let minY = 0;
        let maxY = 0;
        for (const i of allScreens) {
            const right = i.bounds.x + i.bounds.width;
            const bottom = i.bounds.y + i.bounds.height;
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
            minX = Math.min(minX, i.bounds.x);
            minY = Math.min(minY, i.bounds.y);
        }
        const tWidth = maxX - minX;
        const tHeight = maxY - minY;
        const el = view();
        for (const i of allScreens) {
            const x = (i.bounds.x - minX) / tWidth;
            const y = (i.bounds.y - minY) / tHeight;
            const width = i.bounds.width / tWidth;
            const height = i.bounds.height / tHeight;
            const div = view().style({
                width: `${width * 100}%`,
                height: `${height * 100}%`,
                left: `${x * 100}%`,
                top: `${y * 100}%`,
            });
            if (i.id === nowScreenId) {
                div.el.classList.add("now_screen");
            }
            el.add(div);
            div.on("input", () => {
                el.el.querySelector(".now_screen").classList.remove("now_screen");
                div.el.classList.add("now_screen");
                if (!i.image) i.image = i.captureSync();
                setScreen(i);
            });
        }
        screensEl.clear();
        screensEl.add(el);
    } else {
        screensEl.el.style.display = "none";
    }

    setDefaultAction(act);

    if (autoPhotoSelectRect) {
        setTimeout(() => {
            edge();
        }, 0);
    }

    getLinuxWin();
    getWinWin();

    drawClipRect();
    setTimeout(() => {
        whBar(finalRect);
    }, 0);
    rightKey = false;
    changeRightBar(false);
});

ipcRenderer.on("quick", quickClip);

document.addEventListener("mousemove", (e) => {
    nowMouseE = e;
});

document.onwheel = (e) => {
    if (!editor.contains(e.target as HTMLElement) && e.target !== document.body) return;
    if (longRunning) return;

    document.body.classList.add("editor_bg");

    if ((nowType === "draw" || nowType === "shape") && !e.ctrlKey) {
        let v = strokeWidthF.get();
        v += e.deltaY / 50;
        v = Math.max(1, v);
        strokeWidthF.set(v);
        return;
    }

    if (e.ctrlKey) {
        const zz = 1 + Math.abs(e.deltaY) / 300;
        const z = e.deltaY > 0 ? zoomW / zz : zoomW * zz;
        zoomW = z;
        const ozoom = editorP.zoom;
        const nzoom = z / mainCanvas.width;
        const dx = nowMouseE.clientX - editorP.x * ozoom;
        const dy = nowMouseE.clientY - editorP.y * ozoom;
        const x = nowMouseE.clientX - dx * (nzoom / ozoom);
        const y = nowMouseE.clientY - dy * (nzoom / ozoom);
        setEditorP(nzoom, x / nzoom, y / nzoom);
    } else {
        let dx = 0;
        let dy = 0;
        if (e.shiftKey && !e.deltaX) {
            dx = -e.deltaY;
        } else {
            dx = -e.deltaX;
            dy = -e.deltaY;
        }
        setEditorP(editorP.zoom, editorP.x + dx / editorP.zoom, editorP.y + dy / editorP.zoom);
    }
};

document.onkeyup = (e) => {
    if (e.key === "0") {
        if (e.ctrlKey) {
            setEditorP(1, 0, 0);
            zoomW = mainCanvas.width;
        }
    }
};

document.addEventListener("pointerdown", (e) => {
    if (e.button === 1) {
        middleB = e;
        middleP.x = editorP.x;
        middleP.y = editorP.y;
        document.body.classList.add("editor_bg");
    }
});
document.addEventListener("pointermove", (e) => {
    if (middleB) {
        const dx = e.clientX - middleB.clientX;
        const dy = e.clientY - middleB.clientY;
        setEditorP(editorP.zoom, middleP.x + dx / editorP.zoom, middleP.y + dy / editorP.zoom);
    }
});
document.addEventListener("pointerup", (_e) => {
    middleB = null;
});

// 工具栏按钮
toolBar.onmouseup = (e) => {
    const el = <HTMLElement>e.target;
    if (el.parentElement !== toolBar) return;
    if (e.button === 0) {
        tool[el.id.replace("tool_", "")]();
    }
    // 中键取消抬起操作
    if (e.button === 1) {
        el.style.backgroundColor = "";
        autoDo = "no";
    }
};

document.querySelectorAll("#draw_shapes_i > div").forEach((el: HTMLInputElement) => {
    shapeEl[el.id.replace("draw_shapes_", "") as Shape] = el;
});
document.querySelectorAll("#draw_filters_i div").forEach((el: HTMLInputElement) => {
    if (el.id.startsWith("draw_filters_")) filtersEl[el.id.replace("draw_filters_", "") as string] = el;
});

hotkeys.filter = (event) => {
    const tagName = (<HTMLElement>event.target).tagName;
    const v = !(
        (<HTMLElement>event.target).isContentEditable ||
        tagName === "INPUT" ||
        tagName === "SELECT" ||
        tagName === "TEXTAREA"
    );
    return v;
};

toHotkeyScope("normal");
for (const k of toolList) {
    let key = store.get(`工具快捷键.${k}`) as string;
    if (["esc", "escape"].includes(key.toLowerCase())) hotkeys(key, "normal", tool[k]);
    else if (key.toLowerCase() === "enter") hotkeys(key, "normal", tool[k]);
    else hotkeys(key, "all", tool[k]);
    key = key
        .split("+")
        .map((k) => jsKeyCodeDisplay(ele2jsKeyCode(k), process.platform === "darwin").primary)
        .join("");
    if (k === "copy") {
        key += " 双击";
    }
    toolBarEl.els[k].data({ key: key.trim() });
}
for (const i in drawHotKey) {
    const mainKey = i as keyof EditType;
    drawMainEls[mainKey].setAttribute("data-key", showShortKey(drawHotKey[mainKey].键));
    hotkeys(drawHotKey[mainKey].键, () => {
        setEditType(mainKey, editType[mainKey]);
    });
    for (const j in drawHotKey[mainKey].副) {
        drawSideEls[mainKey][j]?.setAttribute("data-key", showShortKey(drawHotKey[mainKey].副[j]));
        hotkeys(drawHotKey[mainKey].副[j], () => {
            setEditType(mainKey, j as EditType[keyof EditType]);
        });
    }
}

for (const k in canvasControlKey) {
    document.getElementById(k).setAttribute("data-key", showShortKey(canvasControlKey[k]));
}

function showShortKey(k: string) {
    return k
        .split("+")
        .map((k) => jsKeyCodeDisplay(ele2jsKeyCode(k), process.platform === "darwin").primary)
        .join("");
}

// alt显示快捷键
document.addEventListener("keydown", (e) => {
    if (e.key === "Alt") {
        document.documentElement.style.setProperty("--hotkey-show", "block");
    }
});
document.addEventListener("keyup", (e) => {
    if (e.key === "Alt") {
        document.documentElement.style.setProperty("--hotkey-show", "none");
    }
});

for (const m of hotkeyTipX) {
    hotkeyTipEl.add(p(m.name));
    for (const k of m.hotkey) {
        const x = view().add(txt(k.name));
        for (let s of k.keys) {
            s = s
                .split("+")
                .map((k) => jsKeyCodeDisplay(ele2jsKeyCode(k), process.platform === "darwin").primary)
                .join("+");
            x.add(txt(s));
        }
        hotkeyTipEl.add(x);
    }
}

setDefaultAction(autoDo);

// OCR
const ocr引擎 = toolBarEl.els.ocrE;
for (const i of store.get("离线OCR")) {
    ocr引擎.add(ele("option").attr({ innerText: i[0], value: i[0] }));
}
for (const i of [
    { v: "baidu", t: "百度" },
    { v: "youdao", t: "有道" },
]) {
    ocr引擎.add(ele("option").attr({ innerText: i.t, value: i.v }));
}
ocr引擎.sv(store.get("OCR.记住") || store.get("OCR.类型"));
ocr引擎.on("input", () => {
    if (store.get("OCR.记住")) store.set("OCR.记住", ocr引擎.gv());
    tool.ocr();
});
toolBarEl.els.ocr.el.title = `OCR(文字识别) - ${ocr引擎.gv()}`;

// 以图搜图
const 识图引擎 = toolBarEl.els.searchE;
识图引擎.sv(store.get("以图搜图.记住") || store.get("以图搜图.引擎"));
识图引擎.on("input", () => {
    if (store.get("以图搜图.记住")) store.set("以图搜图.记住", 识图引擎.gv());
    tool.search();
});
toolBarEl.els.search.el.title = `以图搜图 - ${识图引擎.gv()}`;

trackLocation();

const finishLongB = longTip.els.finish.el;

const lr = longTip.els.rect;

ipcRenderer.on("clip", (_event, type, mouse) => {
    if (type === "mouse") {
        const x = mouse.x;
        const y = mouse.y;
        const el = document.elementsFromPoint(x, y);
        if (longRunning) ipcRenderer.send("clip_main_b", "ignore_mouse", !el.includes(finishLongB));
        else ipcRenderer.send("clip_main_b", "ignore_mouse", false);
    }
    if (type === "update") checkUpdate(true);
});

ipcRenderer.on("save_path", (_event, message) => {
    console.log(message);
    save(message);
});

toolBar.addEventListener("mousedown", (e) => {
    toolBar.style.transition = "none";
    if (e.button === 2) {
        toolPosition.x = e.clientX - toolBar.offsetLeft;
        toolPosition.y = e.clientY - toolBar.offsetTop;
    }
});
toolBar.addEventListener("mouseup", (e) => {
    toolBar.style.transition = "";
    if (e.button === 2) toolPosition = { x: null, y: null };
});

lan(store.get("语言.语言"));
document.title = t(document.title);

// 键盘控制光标
document.querySelector("body").onkeydown = (e) => {
    const tagName = (<HTMLElement>e.target).tagName;
    if ((<HTMLElement>e.target).isContentEditable || tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA")
        return;
    if (longRunning) return;
    if (hotkeys.getScope() === "c_bar") return;
    const o = {
        ArrowUp: "up",
        ArrowRight: "right",
        ArrowDown: "down",
        ArrowLeft: "left",
    };
    if (nowType === "draw" || nowType === "shape") {
        if (!o[e.key]) return;
        let v = strokeWidthF.get();
        v += e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : -1;
        v = Math.max(1, v);
        strokeWidthF.set(v);
        return;
    }
    let v = 1;
    if (e.ctrlKey) v = v * 5;
    if (e.shiftKey) v = v * 10;
    if (o[e.key]) {
        if (down) {
            const op = nowMouseE;
            let x = op.offsetX;
            let y = op.offsetY;
            const d = v;
            switch (o[e.key]) {
                case "up":
                    y = op.offsetY - d;
                    break;
                case "down":
                    y = op.offsetY + d;
                    break;
                case "right":
                    x = op.offsetX + d;
                    break;
                case "left":
                    x = op.offsetX - d;
                    break;
            }
            moveRect(finalRect, { x: op.offsetX, y: op.offsetY }, { x, y });
        } else {
            let x = editorP.x;
            let y = editorP.y;
            const d = (10 * v) / editorP.zoom;
            switch (o[e.key]) {
                case "up":
                    y = editorP.y + d;
                    break;
                case "down":
                    y = editorP.y - d;
                    break;
                case "right":
                    x = editorP.x - d;
                    break;
                case "left":
                    x = editorP.x + d;
                    break;
            }
            setEditorP(editorP.zoom, x, y);
            document.body.classList.add("editor_bg");
            const cX = (nowMouseE.clientX - editorP.x * editorP.zoom) / editorP.zoom;
            const cY = (nowMouseE.clientY - editorP.y * editorP.zoom) / editorP.zoom;
            nowCanvasPosition = pXY2cXY(clipCanvas, cX, cY, cX, cY);
            mouseBar(finalRect, nowCanvasPosition[0], nowCanvasPosition[1]);
        }
    }
};

clipCanvas.onmousedown = (e) => {
    let inRect = false;
    if (isRect) {
        inRect = isInClipRect({ x: e.offsetX, y: e.offsetY });
    } else {
        inRect = isPointInPolygon({ x: e.offsetX, y: e.offsetY });
    }
    if (e.button === 0) {
        clipStart({ x: e.offsetX, y: e.offsetY }, inRect);
    }
    if (e.button === 2) {
        pickColor({ x: e.offsetX, y: e.offsetY });
    }
    toolBar.style.pointerEvents =
        drawBar.style.pointerEvents =
        document.getElementById("clip_wh").style.pointerEvents =
            "none";

    down = true;
};

clipCanvas.onmousemove = (e) => {
    if (down) {
        moved = true;
        rectSelect = true; // 按下并移动，肯定手动选好选区了
    }

    if (e.button === 0) {
        requestAnimationFrame(() => {
            if (selecting) {
                if (isRect) {
                    // 画框
                    finalRect = pXY2cXY(clipCanvas, canvasRect[0], canvasRect[1], e.offsetX, e.offsetY);
                    drawClipRect();
                } else {
                    freeSelect.push(pXY2cXY2(clipCanvas, e.offsetX, e.offsetY));
                    finalRect = pointsOutRect(freeSelect);
                    // todo 化简多边形
                    drawClipPoly(freeSelect);
                }
            }
            if (moving) {
                if (isRect) {
                    moveRect(oFinalRect, oldP, { x: e.offsetX, y: e.offsetY });
                } else {
                    movePoly(oPoly, oldP, { x: e.offsetX, y: e.offsetY });
                }
            }
            if (down) mouseBar(finalRect, nowCanvasPosition[0], nowCanvasPosition[1]);
        });
    }
    if (!selecting && !moving) {
        // 只是悬浮光标时生效，防止在新建或调整选区时光标发生突变
        if (isRect) {
            isInClipRect({ x: e.offsetX, y: e.offsetY });
        } else {
            isPointInPolygon({ x: e.offsetX, y: e.offsetY });
        }
    }

    if (autoSelectRect) {
        inEdge({ x: e.offsetX, y: e.offsetY });
    }
};

clipCanvas.onmouseup = (e) => {
    if (e.button === 0) {
        if (selecting) {
            clipEnd({ x: e.offsetX, y: e.offsetY });
            // 抬起鼠标后工具栏跟随
            followBar(e.clientX, e.clientY);
            // 框选后默认操作
            if (autoDo !== "no" && e.button === 0) {
                tool[autoDo]();
            }
            isShowBars = true;
            showBars(isShowBars);
        }
        if (moving) {
            moving = false;
            oFinalRect = null;
            if (e.button === 0) followBar(e.clientX, e.clientY);
            hisPush();
        }
    }
    toolBar.style.pointerEvents =
        drawBar.style.pointerEvents =
        document.getElementById("clip_wh").style.pointerEvents =
            "auto";

    down = false;
    moved = false;
};

hotkeys("s", () => {
    // 重新启用自动框选提示
    rectSelect = false;
    finalRect = [0, 0, clipCanvas.width, clipCanvas.height];
    drawClipRect();
});

const whHotKeyMap = {
    左上x: whX0,
    左上y: whY0,
    右下x: whX1,
    右下y: whY1,
    宽: whW,
    高: whH,
};

const whHotkey = store.get("大小栏快捷键");
for (const i in whHotkey) {
    if (whHotkey[i])
        hotkeys(whHotkey[i], { keyup: true, keydown: false }, () => {
            whHotKeyMap[i].focus();
        });
}

const whL = [whX0, whY0, whX1, whY1, whW, whH];

whL.forEach((xel) => {
    const el = xel.el;
    const kd = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" && el.value.length === el.selectionEnd) {
            e.preventDefault();
            const next = whL[whL.indexOf(xel) + 1]?.el;
            if (next) {
                next.selectionStart = next.selectionEnd = 0;
                next.focus();
            }
        }
        if (e.key === "ArrowLeft" && 0 === el.selectionStart) {
            e.preventDefault();
            const last = whL[whL.indexOf(xel) - 1]?.el;
            if (last) {
                last.selectionStart = last.selectionEnd = last.value.length;
                last.focus();
            }
        }
        let v = 1;
        if (e.ctrlKey) v = v * 5;
        if (e.shiftKey) v = v * 10;
        if (e.key === "ArrowUp" && !Number.isNaN(Number(el.value))) {
            e.preventDefault();
            el.value = String(Number(el.value) + 1 * v);
            changeWH(xel);
        }
        if (e.key === "ArrowDown" && !Number.isNaN(Number(el.value))) {
            e.preventDefault();
            el.value = String(Number(el.value) - 1 * v);
            changeWH(xel);
        }
        if (e.key === "Escape") {
            el.blur();
        }
    };

    xel.on("input", checkWhBarWidth)
        .on("change", () => changeWH(xel))
        .on("keydown", kd);
});

// 快捷键全屏选择
hotkeys("ctrl+a, command+a", () => {
    finalRect = [0, 0, mainCanvas.width, mainCanvas.height];
    hisPush();
    clipCanvas.style.cursor = "crosshair";
    direction = "";
    drawClipRect();
});

// 生成取色器
if (!取色器显示) document.getElementById("point_color").style.display = "none";

const pointColorCanvasBg = document.createElement("canvas");
pointColorCanvasBg.style.opacity = "0.5";
pointColorCanvasBg.width = pointColorCanvasBg.height = colorSize;
document.getElementById("point_color").append(pointColorCanvasBg);
const pointColorCanvasBgCtx = pointColorCanvasBg.getContext("2d");
const pointColorCanvas = document.createElement("canvas");
pointColorCanvas.width = pointColorCanvas.height = colorSize;
document.getElementById("point_color").append(pointColorCanvas);
const pointColorCanvasCtx = pointColorCanvas.getContext("2d", { willReadFrequently: true });
const pointCenter = document.createElement("div");
document.getElementById("point_color").append(pointCenter);
pointCenter.style.left = `${((colorSize - 1) / 2) * colorISize}px`;
pointCenter.style.top = `${((colorSize - 1) / 2) * colorISize}px`;

const mouseBarEl = document.getElementById("mouse_bar");
if (!store.get("鼠标跟随栏.显示")) mouseBarEl.style.display = "none";
// 鼠标跟随栏
const mainCanvasContext = mainCanvas.getContext("2d");

// 复制坐标
document.getElementById("clip_xy").onclick = () => {
    copy(document.getElementById("clip_xy"));
};

changeRightBar(false);

hotkeys(store.get("其他快捷键.复制颜色"), () => {
    copy(document.querySelector(`#clip_copy > div > div:not(:nth-child(1)) > div:nth-child(${取色器格式位置})`));
});

clipCanvas.ondblclick = () => {
    tool.copy();
};

// 鼠标栏实时跟踪
document.onmousemove = (e) => {
    if (!rightKey) {
        if (clipCanvas.offsetWidth !== 0) {
            // 鼠标位置文字
            const cX = (e.clientX - editorP.x * editorP.zoom) / editorP.zoom;
            const cY = (e.clientY - editorP.y * editorP.zoom) / editorP.zoom;
            nowCanvasPosition = pXY2cXY(clipCanvas, cX, cY, cX, cY);
            // 鼠标跟随栏
            if (!down) mouseBar(finalRect, nowCanvasPosition[0], nowCanvasPosition[1]);
        }
        // 鼠标跟随栏

        const d = 16;
        const x = e.clientX + d;
        const y = e.clientY + d;
        const w = mouseBarW;
        const h = mouseBarH;
        const sw = window.innerWidth;
        const sh = window.innerHeight;

        mouseBarEl.style.left = `${Math.min(x, sw - w - d)}px`;
        mouseBarEl.style.top = `${Math.min(y, sh - h - d)}px`;

        const isDrawBar = drawBar.contains(e.target as HTMLElement);
        const isToolBar = toolBar.contains(e.target as HTMLElement);
        mouseBarEl.classList.toggle("mouse_bar_hide", isDrawBar || isToolBar);

        // 画板栏移动
        if (drawBarMoving) {
            drawBar.style.left = `${e.clientX - drawBarMovingXY[0]}px`;
            drawBar.style.top = `${e.clientY - drawBarMovingXY[1]}px`;
        }
    }
    if (toolPosition.x) {
        toolBar.style.left = `${e.clientX - toolPosition.x}px`;
        toolBar.style.top = `${e.clientY - toolPosition.y}px`;
        trackLocation();
    }
};

document.getElementById("draw_bar").addEventListener("mousedown", (e) => {
    if (e.button !== 0) {
        drawBarMoving = true;
        drawBarMovingXY[0] = e.clientX - document.getElementById("draw_bar").offsetLeft;
        drawBarMovingXY[1] = e.clientY - document.getElementById("draw_bar").offsetTop;
        drawBar.style.transition = "0s";
    }
});
document.getElementById("draw_bar").addEventListener("mouseup", (e) => {
    if (e.button !== 0) {
        drawBarMoving = false;
        drawBarMovingXY = [];
        drawBar.style.transition = "";
    }
});

document.getElementById("draw_select_rect").onclick = () => {
    setEditType("select", "rect");
};
document.getElementById("draw_select_free").onclick = () => {
    setEditType("select", "free");
};
document.getElementById("draw_select_draw").onclick = () => {
    setEditType("select", "draw");
};

hotkeys("ctrl+z", () => {
    undo(true);
});
hotkeys("ctrl+y", () => {
    undo(false);
});

document.getElementById("操作_撤回").onclick = () => {
    undo(true);
};
document.getElementById("操作_重做").onclick = () => {
    undo(false);
};
document.getElementById("操作_复制").onclick = () => {
    fabricCopy();
};
document.getElementById("操作_删除").onclick = () => {
    fabricDelete();
};

const fabricEl = document.createElement("script");
fabricEl.innerHTML = fabricSrc;
document.body.append(fabricEl);
// @ts-ignore
Fabric = window.fabric;
var Fabric;

const fabricCanvas = new Fabric.Canvas("draw_photo");

hisPush();

const fillColor = store.get("图像编辑.默认属性.填充颜色");
const strokeColor = store.get("图像编辑.默认属性.边框颜色");
const strokeWidth = store.get("图像编辑.默认属性.边框宽度");
const freeColor = store.get("图像编辑.默认属性.画笔颜色");
const freeWidth = store.get("图像编辑.默认属性.画笔粗细");

const shapePro: setting["图像编辑"]["形状属性"] = {};

// 编辑栏
const drawMainBar = document.getElementById("draw_main");
const drawSideBar = document.getElementById("draw_side");
showSideBar(false);

document.querySelectorAll("#draw_main > div").forEach((e: HTMLDivElement, index) => {
    const Type: (keyof EditType)[] = ["select", "draw", "shape", "filter"];
    e.addEventListener("mouseenter", () => {
        // 用于防误触，防经过时误切换
        willShowITime = setTimeout(() => {
            showSideBarItem(index);
        }, 100);
    });
    e.addEventListener("pointerleave", () => {
        clearTimeout(willShowITime);
        setTimeout(() => {
            if (!isInDrawBar()) {
                showSideBar(false);
            }
        }, 100);
    });
    e.addEventListener("click", () => {
        setEditType(Type[index], editType[Type[index]]);
    });
});

document.querySelectorAll("#draw_side > div").forEach((el: HTMLElement) => {
    el.onpointerleave = () => {
        setTimeout(() => {
            if (!isInDrawBar()) showSideBar(false);
        }, 100);
    };
});

showBars(isShowBars);

hotkeys(store.get("其他快捷键.隐藏或显示栏"), () => {
    isShowBars = !isShowBars;
    showBars(isShowBars);
});

// 笔
drawSideEls.draw.free.onclick = () => setEditType("draw", "free");
// 橡皮
drawSideEls.draw.eraser.onclick = () => setEditType("draw", "eraser");
// 刷
drawSideEls.draw.spray.onclick = () => setEditType("draw", "spray");

// 阴影
(<HTMLInputElement>document.querySelector("#shadow_blur > range-b")).oninput = freeShadow;

// 几何
document.getElementById("draw_shapes_i").onclick = (e) => {
    const el = e.target as HTMLElement;
    if (el.id.startsWith("draw_shapes_")) {
        const shape = el.id.replace("draw_shapes_", "") as EditType["shape"];
        setEditType("shape", shape);
    } else {
        return;
    }
};
// 层叠位置
document.getElementById("draw_position_i").onclick = (e) => {
    switch ((<HTMLElement>e.target).id) {
        case "draw_position_front":
            fabricCanvas.getActiveObject().bringToFront();
            break;
        case "draw_position_forwards":
            fabricCanvas.getActiveObject().bringForward();
            break;
        case "draw_position_backwards":
            fabricCanvas.getActiveObject().sendBackwards();
            break;
        case "draw_position_back":
            fabricCanvas.getActiveObject().sendToBack();
            break;
    }
};

// 删除快捷键
hotkeys("delete", fabricDelete);

fabricCanvas.on("mouse:down", (options) => {
    // 非常规状态下点击
    if (shape !== "" && (!options.target || options.target.length === 0)) {
        drawingShape = true;
        fabricCanvas.selection = false;
        // 折线与多边形要多次点击，在poly_o_p存储点
        if (!unnormalShapes.includes(shape)) {
            drawOP = [options.e.offsetX, options.e.offsetY];
            draw(shape, "start", drawOP[0], drawOP[1], options.e.offsetX, options.e.offsetY);
        } else {
            // 定义最后一个点,双击,点重复,结束
            const polyOPL = polyOP.at(-1);
            if (!(options.e.offsetX === polyOPL?.x && options.e.offsetY === polyOPL?.y)) {
                polyOP.push({ x: options.e.offsetX, y: options.e.offsetY });
                if (shape === "number") {
                    drawNumber();
                } else {
                    drawPoly(shape);
                }
            } else {
                hisPush();
                polyOP = [];
                drawNumberN = 1;
            }
        }
    }

    if (newFilterSelecting) {
        newFilterO = fabricCanvas.getPointer(options.e);
    }
});
fabricCanvas.on("mouse:move", (options) => {
    if (drawingShape) {
        if (!unnormalShapes.includes(shape)) {
            if (shape !== "") draw(shape, "move", drawOP[0], drawOP[1], options.e.offsetX, options.e.offsetY);
        }
    }
});
fabricCanvas.on("mouse:up", (options) => {
    if (!unnormalShapes.includes(shape)) {
        drawingShape = false;
        if (shape !== "") {
            fabricCanvas.setActiveObject(shapes.at(-1));
            hisPush();
        }
    }

    getFObjectV();
    getFilters();

    if (newFilterSelecting) {
        newFilterSelect(newFilterO, fabricCanvas.getPointer(options.e));
        getFilters();
        hisPush();

        if (willFilter) {
            const i = filtetMap[willFilter] as (typeof filtetMap)["pixelate"];
            if (i.key) {
                const filter = new Fabric.Image.filters[i.f]({ [i.key]: i.value.value ?? 1 });
                applyFilter(i.i, filter);
            } else {
                const filter = new Fabric.Image.filters[i.f]();
                applyFilter(i.i, filter);
            }
            getFilters();
        }
    }

    if (fabricCanvas.isDrawingMode) {
        hisPush();
    }
});

const mask = Fabric.util.createClass(Fabric.Rect, {
    type: "mask",

    initialize: function (options) {
        options = options || {};
        this.callSuper("initialize", options);
    },

    _render: function (ctx: CanvasRenderingContext2D) {
        ctx.save();

        ctx.fillStyle = this.fill;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        const r = this.rect;
        ctx.clearRect(-this.width / 2 + r.x, -this.height / 2 + r.y, r.w, r.h);

        ctx.restore();
    },
});

Fabric.number = Fabric.util.createClass(Fabric.Circle, {
    type: "number",

    initialize: function (options) {
        options = options || {};
        console.log(options);

        this.callSuper("initialize", options);
    },

    _render: function (ctx: CanvasRenderingContext2D) {
        ctx.save();

        this.callSuper("_render", ctx);
        ctx.restore();

        const x = 0;
        const y = 5;

        // 绘制数字
        ctx.fillStyle = this.stroke || "#000";
        ctx.font = `${this.fontSize}px ${字体.等宽字体 || "Arial"}`;
        ctx.textAlign = "center";
        ctx.fillText(String(this.text), x, y);
    },
});

const arrowConfig = store.get("图像编辑.arrow") as setting["图像编辑"]["arrow"];

Fabric.arrow = Fabric.util.createClass(Fabric.Line, {
    type: "arrow",

    initialize: function (options, x) {
        options = options || {};

        this.callSuper("initialize", options, x);
    },

    _render: function (ctx: CanvasRenderingContext2D) {
        ctx.save();

        this.callSuper("_render", ctx);
        ctx.restore();

        const { x1, x2, y1, y2 } = this;

        const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
        const w = arrowConfig.w;
        const h = arrowConfig.h;

        const [x3, y3] = rotate(-w / 2, h, angle);
        const [x4, y4] = rotate(w / 2, h, angle);

        const x0 = (x2 - x1) / 2;
        const y0 = (y2 - y1) / 2;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + x3, y0 + y3);
        if (arrowConfig.type === "stroke") ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + x4, y0 + y4);
        ctx.closePath();

        ctx.fillStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth || 1;
        ctx.strokeStyle = this.stroke;
        ctx.fill();
        ctx.stroke();
    },
});

// 颜色选择

setDrawMode(colorM);
document.getElementById("draw_color_switch").onclick = () => {
    setDrawMode(colorM === "fill" ? "stroke" : "fill");
};

const drawItemsEl = document.getElementById("draw_color_size_i");

ableChangeColor();

colorBar();

(<HTMLInputElement>document.querySelector("#draw_stroke_width > range-b")).oninput = () => {
    setFObjectV(null, null, Number((<HTMLInputElement>document.querySelector("#draw_stroke_width > range-b")).value));
};

// 滤镜
const filterRangeEl = document.querySelector("#draw_filters_range");

for (const id in filtetMap) {
    (document.querySelector(`#draw_filters_${id}`) as HTMLElement).onclick = () => {
        setEditType("filter", id as any);
    };
}

// 伽马
(<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(1)")).oninput =
    (<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(2)")).oninput =
    (<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(3)")).oninput =
        () => {
            const r = (<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(1)")).value;
            const g = (<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(2)")).value;
            const b = (<HTMLInputElement>document.querySelector("#draw_filters_gamma > range-b:nth-child(3)")).value;
            const filter = new Fabric.Image.filters.Gamma({
                gamma: [r, g, b],
            });
            applyFilter(6, filter);
        };
// 灰度
(<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)")).oninput = () => {
    (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)")).checked = false;
    (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)")).checked = false;
    if ((<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)")).checked) {
        const filter = new Fabric.Image.filters.Grayscale({ mode: "average" });
        applyFilter(8, filter);
    }
};
(<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)")).oninput = () => {
    (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)")).checked = false;
    (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)")).checked = false;
    if ((<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)")).checked) {
        const filter = new Fabric.Image.filters.Grayscale({ mode: "lightness" });
        applyFilter(8, filter);
    }
};
(<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)")).oninput = () => {
    (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)")).checked = false;
    (<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)")).checked = false;
    if ((<HTMLInputElement>document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)")).checked) {
        const filter = new Fabric.Image.filters.Grayscale({ mode: "luminosity" });
        applyFilter(8, filter);
    }
};

hotkeys("esc", "drawing", () => {
    setEditType("select", "draw");
});

hotkeys("Ctrl+v", fabricCopy);

setEditType("select", editType.select);

if (store.get("更新.频率") === "start") checkUpdate();
