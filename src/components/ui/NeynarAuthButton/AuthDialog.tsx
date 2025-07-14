'use client';

export function AuthDialog({
  open,
  onClose,
  url,
  isError,
  error,
  step,
  isLoading,
  signerApprovalUrl,
}: {
  open: boolean;
  onClose: () => void;
  url?: string;
  isError: boolean;
  error?: Error | null;
  step: 'signin' | 'access' | 'loading';
  isLoading?: boolean;
  signerApprovalUrl?: string | null;
}) {
  if (!open) return null;

  const getStepContent = () => {
    switch (step) {
      case 'signin':
        return {
          title: 'Sign in',
          description:
            "To sign in, scan the code below with your phone's camera.",
          showQR: true,
          qrUrl: url,
          showOpenButton: true,
        };

      case 'loading':
        return {
          title: 'Setting up access...',
          description:
            'Checking your account permissions and setting up secure access.',
          showQR: false,
          qrUrl: '',
          showOpenButton: false,
        };

      case 'access':
        return {
          title: 'Grant Access',
          description: (
            <div className="space-y-3">
              <p className="text-gray-600 dark:text-gray-400">
                Allow this app to access your Farcaster account:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-green-600 dark:text-green-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      Read Access
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      View your profile and public information
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-blue-600 dark:text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      Write Access
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      Post casts, likes, and update your profile
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ),
          // Show QR code if we have signer approval URL, otherwise show loading
          showQR: !!signerApprovalUrl,
          qrUrl: signerApprovalUrl || '',
          showOpenButton: !!signerApprovalUrl,
        };

      default:
        return {
          title: 'Sign in',
          description:
            "To signin, scan the code below with your phone's camera.",
          showQR: true,
          qrUrl: url,
          showOpenButton: true,
        };
    }
  };

  const content = getStepContent();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[80vh] sm:max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isError ? 'Error' : content.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-3 sm:pt-4 min-h-0">
          {isError ? (
            <div className="text-center">
              <div className="text-red-600 dark:text-red-400 mb-4">
                {error?.message || 'Unknown error, please try again.'}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-6">
                {typeof content.description === 'string' ? (
                  <p className="text-gray-600 dark:text-gray-400">
                    {content.description}
                  </p>
                ) : (
                  content.description
                )}
              </div>

              <div className="mb-6 flex justify-center">
                {content.showQR && content.qrUrl ? (
                  <div className="p-4 bg-white rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        content.qrUrl
                      )}`}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                ) : step === 'loading' || isLoading ? (
                  <div className="w-48 h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex flex-col items-center gap-3">
                      <div className="spinner w-8 h-8" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {step === 'loading'
                          ? 'Setting up access...'
                          : 'Loading...'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {content.showOpenButton && content.qrUrl && (
                <button
                  onClick={() => {
                    if (content.qrUrl) {
                      window.open(
                        content.qrUrl
                          .replace(
                            'https://farcaster.xyz/',
                            'https://client.farcaster.xyz/deeplinks/'
                          )
                          .replace(
                            'https://client.farcaster.xyz/deeplinks/signed-key-request',
                            'https://farcaster.xyz/~/connect'
                          ),
                        '_blank'
                      );
                    }
                  }}
                  className="btn btn-outline flex items-center justify-center gap-2 w-full"
                >
                  I&apos;m using my phone →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
