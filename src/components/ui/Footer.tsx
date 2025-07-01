import React from "react";
import { Tab } from "~/components/App";

interface FooterProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  showWallet?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ activeTab, setActiveTab, showWallet = false }) => (
  <div className="fixed bottom-0 left-0 right-0 mx-4 mb-4 bg-gray-100 dark:bg-gray-800 border-[3px] border-double border-primary px-2 py-2 rounded-lg z-50">
    <div className="flex justify-around items-center h-14">
      <button
        onClick={() => setActiveTab(Tab.Home)}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === Tab.Home ? 'text-primary dark:text-primary-light' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        <span className="text-xl">🏠</span>
        <span className="text-xs mt-1">Home</span>
      </button>
      <button
        onClick={() => setActiveTab(Tab.Actions)}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === Tab.Actions ? 'text-primary dark:text-primary-light' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        <span className="text-xl">⚡</span>
        <span className="text-xs mt-1">Actions</span>
      </button>
      <button
        onClick={() => setActiveTab(Tab.Context)}
        className={`flex flex-col items-center justify-center w-full h-full ${
          activeTab === Tab.Context ? 'text-primary dark:text-primary-light' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        <span className="text-xl">📋</span>
        <span className="text-xs mt-1">Context</span>
      </button>
      {showWallet && (
        <button
          onClick={() => setActiveTab(Tab.Wallet)}
          className={`flex flex-col items-center justify-center w-full h-full ${
            activeTab === Tab.Wallet ? 'text-primary dark:text-primary-light' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <span className="text-xl">👛</span>
          <span className="text-xs mt-1">Wallet</span>
        </button>
      )}
    </div>
  </div>
);
