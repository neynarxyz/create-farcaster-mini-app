/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, signOut, getCsrfToken } from "next-auth/react";
import sdk, {
  SignIn as SignInCore,
  type Haptics,
} from "@farcaster/frame-sdk";
import {
  useAccount,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
  useSwitchChain,
  useChainId,
} from "wagmi";
import {
  useConnection as useSolanaConnection,
  useWallet as useSolanaWallet,
} from '@solana/wallet-adapter-react';
import { useHasSolanaProvider } from "./providers/SafeFarcasterSolanaProvider";
import { ShareButton } from "./ui/Share";

import { config } from "~/components/providers/WagmiProvider";
import { Button } from "~/components/ui/Button";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, degen, mainnet, optimism, unichain } from "wagmi/chains";
import { BaseError, UserRejectedRequestError } from "viem";
import { useSession } from "next-auth/react";
import { useMiniApp } from "@neynar/react";
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Header } from "~/components/ui/Header";
import { Footer } from "~/components/ui/Footer";
import { USE_WALLET, APP_NAME } from "~/lib/constants";

export type Tab = 'home' | 'actions' | 'context' | 'wallet';

interface NeynarUser {
  fid: number;
  score: number;
}

export default function Demo(
  { title }: { title?: string } = { title: "Neynar Starter Kit" }
) {
  const {
    isSDKLoaded,
    context,
    added,
    notificationDetails,
    actions,
    setInitialTab,
    setActiveTab,
    currentTab,
    haptics,
  } = useMiniApp();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendNotificationResult, setSendNotificationResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [neynarUser, setNeynarUser] = useState<NeynarUser | null>(null);
  const [hapticIntensity, setHapticIntensity] = useState<Haptics.ImpactOccurredType>('medium');

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const hasSolanaProvider = useHasSolanaProvider();
  const solanaWallet = useSolanaWallet();
  const { publicKey: solanaPublicKey } = solanaWallet;

  // Set initial tab to home on page load
  useEffect(() => {
    if (isSDKLoaded) {
      setInitialTab('home');
    }
  }, [isSDKLoaded, setInitialTab]);

  useEffect(() => {
    console.log("isSDKLoaded", isSDKLoaded);
    console.log("context", context);
    console.log("address", address);
    console.log("isConnected", isConnected);
    console.log("chainId", chainId);
  }, [context, address, isConnected, chainId, isSDKLoaded]);

  // Fetch Neynar user object when context is available
  useEffect(() => {
    const fetchNeynarUserObject = async () => {
      if (context?.user?.fid) {
        try {
          const response = await fetch(`/api/users?fids=${context.user.fid}`);
          const data = await response.json();
          if (data.users?.[0]) {
            setNeynarUser(data.users[0]);
          }
        } catch (error) {
          console.error('Failed to fetch Neynar user object:', error);
        }
      }
    };

    fetchNeynarUserObject();
  }, [context?.user?.fid]);

  const {
    sendTransaction,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

  const {
    signTypedData,
    error: signTypedError,
    isError: isSignTypedError,
    isPending: isSignTypedPending,
  } = useSignTypedData();

  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();

  const {
    switchChain,
    error: switchChainError,
    isError: isSwitchChainError,
    isPending: isSwitchChainPending,
  } = useSwitchChain();

  const nextChain = useMemo(() => {
    if (chainId === base.id) {
      return optimism;
    } else if (chainId === optimism.id) {
      return degen;
    } else if (chainId === degen.id) {
      return mainnet;
    } else if (chainId === mainnet.id) {
      return unichain;
    } else {
      return base;
    }
  }, [chainId]);

  const handleSwitchChain = useCallback(() => {
    switchChain({ chainId: nextChain.id });
  }, [switchChain, nextChain.id]);

  const sendNotification = useCallback(async () => {
    setSendNotificationResult("");
    if (!notificationDetails || !context) {
      return;
    }

    try {
      const response = await fetch("/api/send-notification", {
        method: "POST",
        mode: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: context.user.fid,
          notificationDetails,
        }),
      });

      if (response.status === 200) {
        setSendNotificationResult("Success");
        return;
      } else if (response.status === 429) {
        setSendNotificationResult("Rate limited");
        return;
      }

      const data = await response.text();
      setSendNotificationResult(`Error: ${data}`);
    } catch (error) {
      setSendNotificationResult(`Error: ${error}`);
    }
  }, [context, notificationDetails]);

  const sendTx = useCallback(() => {
    sendTransaction(
      {
        // call yoink() on Yoink contract
        to: "0x4bBFD120d9f352A0BEd7a014bd67913a2007a878",
        data: "0x9846cd9efc000023c0",
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash);
        },
      }
    );
  }, [sendTransaction]);

  const signTyped = useCallback(() => {
    signTypedData({
      domain: {
        name: APP_NAME,
        version: "1",
        chainId,
      },
      types: {
        Message: [{ name: "content", type: "string" }],
      },
      message: {
        content: `Hello from ${APP_NAME}!`,
      },
      primaryType: "Message",
    });
  }, [chainId, signTypedData]);

  const toggleContext = useCallback(() => {
    setIsContextOpen((prev) => !prev);
  }, []);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="mx-auto py-2 px-4 pb-20">
        <Header neynarUser={neynarUser} />

        <h1 className="text-2xl font-bold text-center mb-4">{title}</h1>

        {currentTab === 'home' && (
          <div className="flex items-center justify-center h-[calc(100vh-200px)] px-6">
            <div className="text-center w-full max-w-md mx-auto">
              <p className="text-lg mb-2">Put your content here!</p>
              <p className="text-sm text-gray-500">Powered by Neynar 🪐</p>
            </div>
          </div>
        )}

        {currentTab === 'actions' && (
          <div className="space-y-3 px-6 w-full max-w-md mx-auto">
            <ShareButton 
              buttonText="Share Mini App"
              cast={{
                text: "Check out this awesome frame @1 @2 @3! 🚀🪐",
                bestFriends: true,
                embeds: [`${process.env.NEXT_PUBLIC_URL}/share/${context?.user?.fid || ''}`]
              }}
              className="w-full"
            />

            <SignIn />

            <Button onClick={() => actions.openUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")} className="w-full">Open Link</Button>

            <Button onClick={actions.addMiniApp} disabled={added} className="w-full">
              Add Mini App to Client
            </Button>

            {sendNotificationResult && (
              <div className="text-sm w-full">
                Send notification result: {sendNotificationResult}
              </div>
            )}
            <Button onClick={sendNotification} disabled={!notificationDetails} className="w-full">
              Send notification
            </Button>

            <Button 
              onClick={async () => {
                if (context?.user?.fid) {
                  const shareUrl = `${process.env.NEXT_PUBLIC_URL}/share/${context.user.fid}`;
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              disabled={!context?.user?.fid}
              className="w-full"
            >
              {copied ? "Copied!" : "Copy share URL"}
            </Button>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Haptic Intensity
              </label>
              <select
                value={hapticIntensity}
                onChange={(e) => setHapticIntensity(e.target.value as typeof hapticIntensity)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="heavy">Heavy</option>
                <option value="soft">Soft</option>
                <option value="rigid">Rigid</option>
              </select>
              <Button 
                onClick={async () => {
                  try {
                    await haptics.impactOccurred(hapticIntensity);
                  } catch (error) {
                    console.error('Haptic feedback failed:', error);
                  }
                }}
                className="w-full"
              >
                Trigger Haptic Feedback
              </Button>
            </div>
          </div>
        )}

        {currentTab === 'context' && (
          <div className="mx-6">
            <h2 className="text-lg font-semibold mb-2">Context</h2>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <pre className="font-mono text-xs whitespace-pre-wrap break-words w-full">
                {JSON.stringify(context, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {currentTab === 'wallet' && USE_WALLET && (
          <div className="space-y-3 px-6 w-full max-w-md mx-auto">
            {address && (
              <div className="text-xs w-full">
                Address: <pre className="inline w-full">{truncateAddress(address)}</pre>
              </div>
            )}

            {chainId && (
              <div className="text-xs w-full">
                Chain ID: <pre className="inline w-full">{chainId}</pre>
              </div>
            )}

            {isConnected ? (
              <Button
                onClick={() => disconnect()}
                className="w-full"
              >
                Disconnect
              </Button>
            ) : context ? (
              <Button
                onClick={() => connect({ connector: connectors[0] })}
                className="w-full"
              >
                Connect
              </Button>
            ) : (
              <div className="space-y-3 w-full">
                <Button
                  onClick={() => connect({ connector: connectors[1] })}
                  className="w-full"
                >
                  Connect Coinbase Wallet
                </Button>
                <Button
                  onClick={() => connect({ connector: connectors[2] })}
                  className="w-full"
                >
                  Connect MetaMask
                </Button>
              </div>
            )}

            <SignEvmMessage />

            {isConnected && (
              <>
                <SendEth />
                <Button
                  onClick={sendTx}
                  disabled={!isConnected || isSendTxPending}
                  isLoading={isSendTxPending}
                  className="w-full"
                >
                  Send Transaction (contract)
                </Button>
                {isSendTxError && renderError(sendTxError)}
                {txHash && (
                  <div className="text-xs w-full">
                    <div>Hash: {truncateAddress(txHash)}</div>
                    <div>
                      Status:{" "}
                      {isConfirming
                        ? "Confirming..."
                        : isConfirmed
                        ? "Confirmed!"
                        : "Pending"}
                    </div>
                  </div>
                )}
                <Button
                  onClick={signTyped}
                  disabled={!isConnected || isSignTypedPending}
                  isLoading={isSignTypedPending}
                  className="w-full"
                >
                  Sign Typed Data
                </Button>
                {isSignTypedError && renderError(signTypedError)}
                <Button
                  onClick={handleSwitchChain}
                  disabled={isSwitchChainPending}
                  isLoading={isSwitchChainPending}
                  className="w-full"
                >
                  Switch to {nextChain.name}
                </Button>
                {isSwitchChainError && renderError(switchChainError)}
              </>
            )}
          </div>
        )}

        <Footer activeTab={currentTab as Tab} setActiveTab={setActiveTab} showWallet={USE_WALLET} />
      </div>
    </div>
  );
}

// Solana functions inspired by farcaster demo
// https://github.com/farcasterxyz/frames-v2-demo/blob/main/src/components/Demo.tsx
function SignSolanaMessage({ signMessage }: { signMessage?: (message: Uint8Array) => Promise<Uint8Array> }) {
  const [signature, setSignature] = useState<string | undefined>();
  const [signError, setSignError] = useState<Error | undefined>();
  const [signPending, setSignPending] = useState(false);

  const handleSignMessage = useCallback(async () => {
    setSignPending(true);
    try {
      if (!signMessage) {
        throw new Error('no Solana signMessage');
      }
      const input = new TextEncoder().encode("Hello from Solana!");
      const signatureBytes = await signMessage(input);
      const signature = btoa(String.fromCharCode(...signatureBytes));
      setSignature(signature);
      setSignError(undefined);
    } catch (e) {
      if (e instanceof Error) {
        setSignError(e);
      }
    } finally {
      setSignPending(false);
    }
  }, [signMessage]);

  return (
    <>
      <Button
        onClick={handleSignMessage}
        disabled={signPending}
        isLoading={signPending}
        className="mb-4"
      >
        Sign Message
      </Button>
      {signError && renderError(signError)}
      {signature && (
        <div className="mt-2 text-xs">
          <div>Signature: {signature}</div>
        </div>
      )}
    </>
  );
}

function SendSolana() {
  const [state, setState] = useState<
    | { status: 'none' }
    | { status: 'pending' }
    | { status: 'error'; error: Error }
    | { status: 'success'; signature: string }
  >({ status: 'none' });

  const { connection: solanaConnection } = useSolanaConnection();
  const { sendTransaction, publicKey } = useSolanaWallet();

  // This should be replaced but including it from the original demo
  // https://github.com/farcasterxyz/frames-v2-demo/blob/main/src/components/Demo.tsx#L718
  const ashoatsPhantomSolanaWallet = 'Ao3gLNZAsbrmnusWVqQCPMrcqNi6jdYgu8T6NCoXXQu1';

  const handleSend = useCallback(async () => {
    setState({ status: 'pending' });
    try {
      if (!publicKey) {
        throw new Error('no Solana publicKey');
      }

      const { blockhash } = await solanaConnection.getLatestBlockhash();
      if (!blockhash) {
        throw new Error('failed to fetch latest Solana blockhash');
      }

      const fromPubkeyStr = publicKey.toBase58();
      const toPubkeyStr = ashoatsPhantomSolanaWallet;
      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(fromPubkeyStr),
          toPubkey: new PublicKey(toPubkeyStr),
          lamports: 0n,
        }),
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(fromPubkeyStr);

      const simulation = await solanaConnection.simulateTransaction(transaction);
      if (simulation.value.err) {
        // Gather logs and error details for debugging
        const logs = simulation.value.logs?.join('\n') ?? 'No logs';
        const errDetail = JSON.stringify(simulation.value.err);
        throw new Error(`Simulation failed: ${errDetail}\nLogs:\n${logs}`);
      }
      const signature = await sendTransaction(transaction, solanaConnection);
      setState({ status: 'success', signature });
    } catch (e) {
      if (e instanceof Error) {
        setState({ status: 'error', error: e });
      } else {
        setState({ status: 'none' });
      }
    }
  }, [sendTransaction, publicKey, solanaConnection]);

  return (
    <>
      <Button
        onClick={handleSend}
        disabled={state.status === 'pending'}
        isLoading={state.status === 'pending'}
        className="mb-4"
      >
        Send Transaction (sol)
      </Button>
      {state.status === 'error' && renderError(state.error)}
      {state.status === 'success' && (
        <div className="mt-2 text-xs">
          <div>Hash: {truncateAddress(state.signature)}</div>
        </div>
      )}
    </>
  );
}

function SignEvmMessage() {
  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const {
    signMessage,
    data: signature,
    error: signError,
    isError: isSignError,
    isPending: isSignPending,
  } = useSignMessage();

  const handleSignMessage = useCallback(async () => {
    if (!isConnected) {
      await connectAsync({
        chainId: base.id,
        connector: config.connectors[0],
      });
    }

    signMessage({ message: `Hello from ${APP_NAME}!` });
  }, [connectAsync, isConnected, signMessage]);

  return (
    <>
      <Button
        onClick={handleSignMessage}
        disabled={isSignPending}
        isLoading={isSignPending}
      >
        Sign Message
      </Button>
      {isSignError && renderError(signError)}
      {signature && (
        <div className="mt-2 text-xs">
          <div>Signature: {signature}</div>
        </div>
      )}
    </>
  );
}

function SendEth() {
  const { isConnected, chainId } = useAccount();
  const {
    sendTransaction,
    data,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: data,
    });

  const toAddr = useMemo(() => {
    // Protocol guild address
    return chainId === base.id
      ? "0x32e3C7fD24e175701A35c224f2238d18439C7dBC"
      : "0xB3d8d7887693a9852734b4D25e9C0Bb35Ba8a830";
  }, [chainId]);

  const handleSend = useCallback(() => {
    sendTransaction({
      to: toAddr,
      value: 1n,
    });
  }, [toAddr, sendTransaction]);

  return (
    <>
      <Button
        onClick={handleSend}
        disabled={!isConnected || isSendTxPending}
        isLoading={isSendTxPending}
      >
        Send Transaction (eth)
      </Button>
      {isSendTxError && renderError(sendTxError)}
      {data && (
        <div className="mt-2 text-xs">
          <div>Hash: {truncateAddress(data)}</div>
          <div>
            Status:{" "}
            {isConfirming
              ? "Confirming..."
              : isConfirmed
              ? "Confirmed!"
              : "Pending"}
          </div>
        </div>
      )}
    </>
  );
}

function SignIn() {
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signInResult, setSignInResult] = useState<SignInCore.SignInResult>();
  const [signInFailure, setSignInFailure] = useState<string>();
  const { data: session, status } = useSession();

  const getNonce = useCallback(async () => {
    const nonce = await getCsrfToken();
    if (!nonce) throw new Error("Unable to generate nonce");
    return nonce;
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      setSigningIn(true);
      setSignInFailure(undefined);
      const nonce = await getNonce();
      const result = await sdk.actions.signIn({ nonce });
      setSignInResult(result);

      await signIn("credentials", {
        message: result.message,
        signature: result.signature,
        redirect: false,
      });
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        setSignInFailure("Rejected by user");
        return;
      }

      setSignInFailure("Unknown error");
    } finally {
      setSigningIn(false);
    }
  }, [getNonce]);

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true);
      await signOut({ redirect: false });
      setSignInResult(undefined);
    } finally {
      setSigningOut(false);
    }
  }, []);

  return (
    <>
      {status !== "authenticated" && (
        <Button onClick={handleSignIn} disabled={signingIn}>
          Sign In with Farcaster
        </Button>
      )}
      {status === "authenticated" && (
        <Button onClick={handleSignOut} disabled={signingOut}>
          Sign out
        </Button>
      )}
      {session && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">Session</div>
          <div className="whitespace-pre">
            {JSON.stringify(session, null, 2)}
          </div>
        </div>
      )}
      {signInFailure && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">SIWF Result</div>
          <div className="whitespace-pre">{signInFailure}</div>
        </div>
      )}
      {signInResult && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">SIWF Result</div>
          <div className="whitespace-pre">
            {JSON.stringify(signInResult, null, 2)}
          </div>
        </div>
      )}
    </>
  );
}

const renderError = (error: Error | null) => {
  if (!error) return null;
  if (error instanceof BaseError) {
    const isUserRejection = error.walk(
      (e) => e instanceof UserRejectedRequestError
    );

    if (isUserRejection) {
      return <div className="text-red-500 text-xs mt-1">Rejected by user.</div>;
    }
  }

  return <div className="text-red-500 text-xs mt-1">{error.message}</div>;
};

