import UIKit
import WebKit

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var webView: WKWebView!

    override var prefersStatusBarHidden: Bool {
        return true
    }

    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return .all
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")

        let userContentController = WKUserContentController()
        userContentController.add(self, name: "iosBridge")
        config.userContentController = userContentController

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.backgroundColor = .black
        webView.isOpaque = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        
        view.addSubview(webView)

        loadWebContent()
    }

    func loadWebContent() {
        if let wwwURL = Bundle.main.url(forResource: "www", withExtension: nil) {
            let htmlURL = wwwURL.appendingPathComponent("index.html")
            webView.loadFileURL(htmlURL, allowingReadAccessTo: wwwURL)
        } else if let htmlURL = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(htmlURL, allowingReadAccessTo: Bundle.main.bundleURL)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "iosBridge", let dict = message.body as? [String: Any] {
            if let action = dict["action"] as? String, action == "setOrientation", let mode = dict["mode"] as? String {
                DispatchQueue.main.async {
                    self.changeOrientation(mode: mode)
                }
            }
        }
    }

    func changeOrientation(mode: String) {
        if #available(iOS 16.0, *) {
            guard let windowScene = view.window?.windowScene else { return }
            var mask: UIInterfaceOrientationMask = .landscape
            if mode == "portrait" {
                mask = .portrait
            } else if mode == "sensor" {
                mask = .allButUpsideDown
            }
            windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: mask)) { error in
                print("Orientation update error: \(error)")
            }
        }
    }
}
