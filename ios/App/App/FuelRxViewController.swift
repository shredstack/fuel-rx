import UIKit
import Capacitor
import WebKit

class FuelRxViewController: CAPBridgeViewController {

    private var retryView: RetryView?
    private var retryCount = 0
    private let maxAutoRetries = 3
    private let retryDelay: TimeInterval = 2.0

    override func viewDidLoad() {
        super.viewDidLoad()
        setupRetryView()
    }

    override func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        super.webView(webView, didFailProvisionalNavigation: navigation, withError: error)
        handleLoadError(error)
    }

    override func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        super.webView(webView, didFail: navigation, withError: error)
        handleLoadError(error)
    }

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

    private func handleLoadError(_ error: Error) {
        print("FuelRx: WebView load error - \(error.localizedDescription)")

        // Check if it's a network-related error
        let nsError = error as NSError
        let networkErrorCodes = [
            NSURLErrorNotConnectedToInternet,
            NSURLErrorNetworkConnectionLost,
            NSURLErrorTimedOut,
            NSURLErrorCannotFindHost,
            NSURLErrorCannotConnectToHost,
            NSURLErrorDNSLookupFailed
        ]

        if networkErrorCodes.contains(nsError.code) {
            if retryCount < maxAutoRetries {
                // Auto-retry with delay
                retryCount += 1
                print("FuelRx: Auto-retrying (\(retryCount)/\(maxAutoRetries))...")
                DispatchQueue.main.asyncAfter(deadline: .now() + retryDelay) { [weak self] in
                    self?.retryLoading()
                }
            } else {
                // Show manual retry UI
                showRetryView()
            }
        }
    }

    private func showRetryView() {
        DispatchQueue.main.async { [weak self] in
            self?.retryView?.isHidden = false
            self?.view.bringSubviewToFront(self?.retryView ?? UIView())
        }
    }

    private func hideRetryView() {
        DispatchQueue.main.async { [weak self] in
            self?.retryView?.isHidden = true
        }
    }

    private func retryLoading() {
        hideRetryView()

        // Reload the WebView
        if let webView = self.webView {
            if let url = webView.url {
                let request = URLRequest(url: url)
                webView.load(request)
            } else if let serverUrl = URL(string: "https://fuel-rx.shredstack.net") {
                let request = URLRequest(url: serverUrl)
                webView.load(request)
            }
        }
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
        retryButton.setTitle("Try Again", for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        retryButton.setTitleColor(.white, for: .normal)
        retryButton.backgroundColor = UIColor(red: 0.235, green: 0.533, blue: 0.424, alpha: 1.0) // Primary green
        retryButton.layer.cornerRadius = 12
        retryButton.contentEdgeInsets = UIEdgeInsets(top: 14, left: 32, bottom: 14, right: 32)
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
