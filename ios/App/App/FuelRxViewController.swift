import UIKit
import Capacitor
import WebKit

class FuelRxViewController: CAPBridgeViewController {

    private var retryView: RetryView?
    private var retryCount = 0
    private let maxAutoRetries = 3
    private let retryDelay: TimeInterval = 2.0
    private let loadTimeout: TimeInterval = 20.0
    private let fallbackURL = URL(string: "https://fuel-rx.shredstack.net")!

    private var progressObservation: NSKeyValueObservation?
    private var loadTimeoutTimer: Timer?
    private var watchdogStarted = false
    private var hasEverLoaded = false

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthKitNutritionPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupRetryView()
        observeWebViewLoad()
        observeAppLifecycle()
    }

    deinit {
        progressObservation?.invalidate()
        loadTimeoutTimer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Load observation

    // Capacitor owns the WKNavigationDelegate, so we can't hook didFail directly
    // without risking breakage. Instead we watch estimatedProgress + a watchdog
    // timer to detect stuck cold-start loads.
    private func observeWebViewLoad() {
        guard let webView = self.webView else { return }

        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, change in
            guard let self = self else { return }

            if webView.isLoading && !self.watchdogStarted {
                self.startLoadWatchdog()
            }

            if let progress = change.newValue, progress >= 1.0 {
                self.handleLoadSuccess()
            }
        }
    }

    private func startLoadWatchdog() {
        watchdogStarted = true
        loadTimeoutTimer?.invalidate()
        loadTimeoutTimer = Timer.scheduledTimer(withTimeInterval: loadTimeout, repeats: false) { [weak self] _ in
            guard let self = self, let webView = self.webView else { return }
            if webView.isLoading && webView.estimatedProgress < 1.0 {
                print("FuelRx: Load timeout (\(self.loadTimeout)s) exceeded")
                self.handleLoadError(NSError(
                    domain: NSURLErrorDomain,
                    code: NSURLErrorTimedOut,
                    userInfo: [NSLocalizedDescriptionKey: "Load watchdog timeout"]
                ))
            }
        }
    }

    private func handleLoadSuccess() {
        hasEverLoaded = true
        retryCount = 0
        watchdogStarted = false
        loadTimeoutTimer?.invalidate()
        loadTimeoutTimer = nil
        hideRetryView()
    }

    private func handleLoadError(_ error: Error) {
        print("FuelRx: WebView load error - \(error.localizedDescription)")
        watchdogStarted = false
        loadTimeoutTimer?.invalidate()
        loadTimeoutTimer = nil

        if retryCount < maxAutoRetries {
            retryCount += 1
            print("FuelRx: Auto-retrying (\(retryCount)/\(maxAutoRetries))...")
            DispatchQueue.main.asyncAfter(deadline: .now() + retryDelay) { [weak self] in
                self?.retryLoading()
            }
        } else {
            showRetryView()
        }
    }

    // MARK: - App lifecycle

    private func observeAppLifecycle() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    // When the app returns from background, iOS may have evicted the WebView's
    // content process — the WebView is then alive but blank. Probe with a tiny
    // JS expression: if it can't execute, reload from the server.
    @objc private func handleAppForeground() {
        guard hasEverLoaded, let webView = self.webView else { return }

        webView.evaluateJavaScript("document.readyState") { [weak self] result, error in
            guard let self = self else { return }
            let isAlive = error == nil && (result as? String) != nil
            if !isAlive {
                print("FuelRx: WebView blank on foreground, forcing reload")
                self.retryCount = 0
                self.retryLoading()
            }
        }
    }

    // MARK: - Retry UI

    private func setupRetryView() {
        let retry = RetryView(frame: view.bounds)
        retry.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        retry.isHidden = true
        retry.onRetry = { [weak self] in
            self?.retryLoading()
        }
        view.addSubview(retry)
        retryView = retry
    }

    private func showRetryView() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let retry = self.retryView else { return }
            retry.isHidden = false
            self.view.bringSubviewToFront(retry)
        }
    }

    private func hideRetryView() {
        DispatchQueue.main.async { [weak self] in
            self?.retryView?.isHidden = true
        }
    }

    private func retryLoading() {
        hideRetryView()
        guard let webView = self.webView else { return }
        let urlToLoad = webView.url ?? fallbackURL
        webView.load(URLRequest(url: urlToLoad))
    }
}

// MARK: - Retry View

class RetryView: UIView {

    var onRetry: (() -> Void)?

    private let containerView = UIView()
    private let iconLabel = UILabel()
    private let titleLabel = UILabel()
    private let messageLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }

    private func setupUI() {
        backgroundColor = UIColor(red: 0.094, green: 0.094, blue: 0.106, alpha: 1.0) // #18181b

        // Container
        containerView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(containerView)

        // Icon
        iconLabel.translatesAutoresizingMaskIntoConstraints = false
        iconLabel.text = "📡"
        iconLabel.font = .systemFont(ofSize: 48)
        iconLabel.textAlignment = .center
        containerView.addSubview(iconLabel)

        // Title
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = "Connection Issue"
        titleLabel.font = .systemFont(ofSize: 22, weight: .semibold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        containerView.addSubview(titleLabel)

        // Message
        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        messageLabel.text = "We couldn't connect to FuelRx.\nPlease check your internet connection."
        messageLabel.font = .systemFont(ofSize: 16)
        messageLabel.textColor = UIColor(white: 0.7, alpha: 1.0)
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        containerView.addSubview(messageLabel)

        // Retry Button
        retryButton.translatesAutoresizingMaskIntoConstraints = false
        var buttonConfig = UIButton.Configuration.filled()
        buttonConfig.title = "Try Again"
        buttonConfig.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 32, bottom: 14, trailing: 32)
        buttonConfig.baseBackgroundColor = UIColor(red: 0.235, green: 0.533, blue: 0.424, alpha: 1.0)
        buttonConfig.baseForegroundColor = .white
        buttonConfig.cornerStyle = .large
        buttonConfig.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
            return outgoing
        }
        retryButton.configuration = buttonConfig
        retryButton.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        containerView.addSubview(retryButton)

        // Layout
        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: centerYAnchor),
            containerView.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 32),
            containerView.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -32),

            iconLabel.topAnchor.constraint(equalTo: containerView.topAnchor),
            iconLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),

            titleLabel.topAnchor.constraint(equalTo: iconLabel.bottomAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),

            messageLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            messageLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            messageLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),

            retryButton.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 24),
            retryButton.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            retryButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
        ])
    }

    @objc private func retryTapped() {
        onRetry?()
    }
}
