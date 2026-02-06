export default function Test() {
  const checkAPI = () => {
    console.log('window.electron:', window.electron);
    console.log('typeof window.electron:', typeof window.electron);

    if (window.electron) {
      console.log('✅ Electron API is available!');
      console.log('API methods:', Object.keys(window.electron));
    } else {
      console.log('❌ Electron API is NOT available');
    }
  };

  // Run check on mount
  React.useEffect(() => {
    checkAPI();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">API Test</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <button
          onClick={checkAPI}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Check Electron API
        </button>
        <div className="mt-4">
          <p className="text-gray-600">
            Open DevTools (View → Toggle Developer Tools) and click the button to see the API status in the console.
          </p>
          <pre className="mt-4 p-4 bg-gray-100 rounded text-xs">
            {JSON.stringify({
              electronAvailable: typeof window.electron !== 'undefined',
              electronType: typeof window.electron,
            }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
