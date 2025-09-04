// SelectCite - Academic Citation Helper
// Background Service Worker for Manifest V3

const selectcite = {
  /**
   * Search for BibTeX citations based on selected text
   * @param {string} keyword - Selected text to search for
   */
  async searchForBibTex(keyword) {
    if (!keyword) {
      console.warn("No keyword provided for search");
      return;
    }

    try {
      // Clean up the search keyword
      const cleanKeyword = keyword.trim().replace(/\s+/g, ' ');
      
      // Open Google Scholar search with the selected text
      await this.openScholarSearch(cleanKeyword);
      
      // Show helpful notification to user
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon32.png',
        title: 'SelectCite',
        message: `Searching for: "${cleanKeyword.length > 50 ? cleanKeyword.substring(0, 50) + '...' : cleanKeyword}"\nClick "Cite" then "BibTeX" for the paper you need.`
      });

    } catch (error) {
      console.error('Error in searchForBibTex:', error);
      this.showErrorNotification();
    }
  },

  /**
   * Open Google Scholar search page
   * @param {string} searchTerm - Term to search for
   */
  async openScholarSearch(searchTerm) {
    try {
      const encodedTerm = encodeURIComponent(searchTerm);
      const scholarUrl = `https://scholar.google.com/scholar?hl=en&q=${encodedTerm}`;
      
      await chrome.tabs.create({ url: scholarUrl });
    } catch (error) {
      console.error('Error opening Scholar search:', error);
      throw error;
    }
  },

  /**
   * Show error notification to user
   */
  showErrorNotification() {
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon32.png',
      title: 'SelectCite Error',
      message: 'Sorry, unable to search for citations. Please try again or search manually on Google Scholar.'
    });
  },

  /**
   * Get current active tab URL
   * @returns {Promise<string|null>} Current tab URL or null if error
   */
  async getCurrentTabUrl() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.url || null;
    } catch (error) {
      console.error('Error getting current tab URL:', error);
      return null;
    }
  }
};

// Extension lifecycle events
chrome.runtime.onInstalled.addListener((details) => {
  console.log('SelectCite extension installed/updated:', details.reason);
  
  // Create context menu item for text selection
  chrome.contextMenus.create({
    id: 'selectcite-search',
    title: 'Search citation for "%s"',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  });

  // Show welcome notification on fresh install
  if (details.reason === 'install') {
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon32.png',
      title: 'Welcome to SelectCite!',
      message: 'Select any text and right-click to search for academic citations. Happy researching!'
    });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'selectcite-search' && info.selectionText) {
    const selectedText = info.selectionText.trim();
    
    if (selectedText.length > 0) {
      console.log('Searching for citation:', selectedText);
      selectcite.searchForBibTex(selectedText);
    } else {
      console.warn('Selected text is empty after trimming');
    }
  }
});

// Handle extension icon click (optional functionality)
chrome.action.onClicked.addListener(async (tab) => {
  // Open Google Scholar main page
  try {
    await chrome.tabs.create({ url: 'https://scholar.google.com/' });
    
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon32.png',
      title: 'SelectCite',
      message: 'Google Scholar opened. You can search manually or select text on any page and right-click.'
    });
  } catch (error) {
    console.error('Error opening Google Scholar:', error);
  }
});

// Handle notification clicks
chrome.notifications?.onClicked?.addListener((notificationId) => {
  // Clear the notification when clicked
  chrome.notifications.clear(notificationId);
});

// Extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('SelectCite extension started');
});