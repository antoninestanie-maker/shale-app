// ─────────────────────────────────────────────────────────────────────────────
// Un WKWebView piloté par script : le MOTEUR de l'app installée, pas Chrome.
//
// Pourquoi : Chrome (Puppeteer) ne dit rien de ce que voit Antonin dans
// Shale.app, et le panneau navigateur ne rend ni animation ni survol
// (PIEGES § 11.6). Surtout, un VRAI survol — :hover, transitions, rognage —
// se rejoue ici sans prendre le curseur d'Antonin : la fenêtre est quasi
// transparente et se fait passer pour la fenêtre active (PIEGES § 21.11).
//
//   swiftc -O tools/webkit-pilote.swift -o /tmp/wk
//   /tmp/wk plan.json dossier-de-captures
//
// Le plan est une liste de pas JSON, exécutés dans l'ordre :
//   {"apparence":"dark"|"light"}   {"url":"http://localhost:5199/"}
//   {"js":"…","log":true,"nom":"…"}  {"attendre":ms}
//   {"survol":[x,y]}  {"survolSel":"sélecteur","index":0,"dx":0.5,"dy":0.5}
//   {"clic":[x,y]}    {"capture":"nom","zone":[x,y,l,h]}   (points CSS)
// À lancer sur le mode démo (PASSATION § 13.2), jamais sur tauri dev.
// ─────────────────────────────────────────────────────────────────────────────
import Cocoa
import WebKit

let args = CommandLine.arguments
let plan = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[1]))) as! [[String: Any]]
let out = args[2]
let W = 1360.0, H = 880.0

final class Nav: NSObject, WKNavigationDelegate {
  var fini = false
  func webView(_ w: WKWebView, didFinish n: WKNavigation!) { fini = true }
}
func spin(_ ms: Double) { RunLoop.main.run(until: Date().addingTimeInterval(ms / 1000)) }

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let cfg = WKWebViewConfiguration()
cfg.userContentController.addUserScript(WKUserScript(
  source: "try{localStorage.setItem('shale.lang','fr');localStorage.setItem('shale.onboarded','1')}catch(e){}",
  injectionTime: .atDocumentStart, forMainFrameOnly: true))
let rect = NSRect(x: 0, y: 0, width: W, height: H)
final class Fen: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true }; override var isKeyWindow: Bool { true }; override var isMainWindow: Bool { true } }
let win = Fen(contentRect: rect, styleMask: [.borderless], backing: .buffered, defer: false)
cfg.preferences.inactiveSchedulingPolicy = .none
let wv = WKWebView(frame: rect, configuration: cfg)
let selOcc = NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")
if wv.responds(to: selOcc) {
  typealias F = @convention(c) (AnyObject, Selector, Bool) -> Void
  unsafeBitCast(wv.method(for: selOcc), to: F.self)(wv, selOcc, false)
} else { print("pas de réglage d'occultation") }
let nav = Nav(); wv.navigationDelegate = nav
win.contentView = wv
win.acceptsMouseMovedEvents = true
win.setFrameOrigin(NSPoint(x: 40, y: 40))
win.alphaValue = 0.01
win.orderFrontRegardless()
win.makeKey()

func souris(_ type: NSEvent.EventType, _ x: Double, _ y: Double) {
  let e = NSEvent.mouseEvent(with: type, location: NSPoint(x: x, y: H - y), modifierFlags: [],
    timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: win.windowNumber, context: nil,
    eventNumber: 0, clickCount: 1, pressure: type == .leftMouseDown ? 1 : 0)!
  let simu = NSSelectorFromString("_simulateMouseMove:")
  if type == .mouseMoved && wv.responds(to: simu) {
    wv.perform(simu, with: e)
  } else {
    win.sendEvent(e)
  }
}
func js(_ s: String) -> Any? {
  var fini = false; var res: Any? = nil
  wv.evaluateJavaScript(s) { r, e in res = r ?? (e.map { "ERR \($0)" }); fini = true }
  while !fini { spin(20) }
  return res
}
func shot(_ nom: String, _ clip: [Double]?) {
  var fini = false
  let c = WKSnapshotConfiguration()
  if let k = clip { c.rect = NSRect(x: k[0], y: k[1], width: k[2], height: k[3]) }
  wv.takeSnapshot(with: c) { img, err in
    if let img = img, let t = img.tiffRepresentation, let r = NSBitmapImageRep(data: t),
       let png = r.representation(using: .png, properties: [:]) {
      try? png.write(to: URL(fileURLWithPath: "\(out)/\(nom).png"))
    } else { print("capture ratée", nom, err as Any) }
    fini = true
  }
  while !fini { spin(20) }
}

for pas in plan {
  if let u = pas["url"] as? String {
    nav.fini = false; wv.load(URLRequest(url: URL(string: u)!))
    while !nav.fini { spin(50) }
  }
  if let a = pas["apparence"] as? String { wv.appearance = NSAppearance(named: a == "dark" ? .darkAqua : .aqua) }
  if let s = pas["js"] as? String { let r = js(s); if pas["log"] as? Bool == true { print(pas["nom"] ?? "", r ?? "nil") } }
  if let p = pas["survol"] as? [Double] { souris(.mouseMoved, p[0], p[1]) }
  if let sel = pas["survolSel"] as? String {
    let i = (pas["index"] as? Int) ?? 0
    let dx = (pas["dx"] as? Double) ?? 0.5, dy = (pas["dy"] as? Double) ?? 0.5
    if let r = js("(()=>{const e=document.querySelectorAll(\(String(reflecting: sel)))[\(i)];if(!e)return null;e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return [b.x+b.width*\(dx),b.y+b.height*\(dy)]})()") as? [Double] {
      souris(.mouseMoved, r[0] - 30, r[1]); spin(60); souris(.mouseMoved, r[0], r[1])
    } else { print("introuvable", sel) }
  }
  if let p = pas["clic"] as? [Double] { souris(.leftMouseDown, p[0], p[1]); souris(.leftMouseUp, p[0], p[1]) }
  if let ms = pas["attendre"] as? Double { spin(ms) }
  if let n = pas["capture"] as? String { shot(n, pas["zone"] as? [Double]) }
}
print("ok")
