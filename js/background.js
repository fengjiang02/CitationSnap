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
      const cleanKeyword = keyword.trim().replace(/\s+/g, '+');
      
      // First, search for the paper on Google Scholar
      const searchUrl = `https://scholar.google.com/scholar?oi=gsb95&output=gsb&hl=en&q=${encodeURIComponent(cleanKeyword)}`;
      
      console.log('Searching:', searchUrl);
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        throw new Error('Search request failed');
      }
      
      const searchText = await searchResponse.text();
      
      // Try to parse the response and extract paper ID
      const paperId = this.extractPaperIdFromResponse(searchText);
      
      if (paperId) {
        // Get the citation page for this paper
        await this.getBibTexFromPaperId(paperId);
      } else {
        // Fallback: open search results page for manual selection
        console.warn("Could not extract paper ID, falling back to manual search");
        await this.openScholarSearch(cleanKeyword);
        
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: 'icons/icon32.png',
          title: 'SelectCite',
          message: `Found search results for: "${keyword}"\nPlease click "Cite" then "BibTeX" manually.`
        });
      }

    } catch (error) {
      console.error('Error in searchForBibTex:', error);
      // Fallback to manual search
      await this.openScholarSearch(keyword.trim().replace(/\s+/g, '+'));
      this.showErrorNotification();
    }
  },

  /**
   * Extract paper ID from Google Scholar search response
   * @param {string} responseText - HTML response from Scholar search
   * @returns {string|null} Paper ID or null if not found
   */
  extractPaperIdFromResponse(responseText) {
    try {
      // Try multiple patterns to extract paper ID
      const patterns = [
        // Original pattern
        /window\.googleSearchResponse\s*=\s*({.*?});/,
        // Alternative patterns for different Scholar formats
        /"r":\s*\[({.*?})\]/,
        /data-clk="([^"]*)"/,
        /data-href="\/scholar\?q=info:([^:]+):scholar\.google\.com/
      ];
      
      for (const pattern of patterns) {
        const match = responseText.match(pattern);
        if (match) {
          console.log('Found potential match:', match[1]);
          
          if (pattern === patterns[0]) {
            // Parse JSON response
            const searchData = JSON.parse(match[1]);
            if (searchData.r && searchData.r.length > 0 && searchData.r[0].l && searchData.r[0].l.f && searchData.r[0].l.f.u) {
              return searchData.r[0].l.f.u.replace('#f', '');
            }
          } else if (pattern === patterns[3]) {
            // Direct paper ID extraction
            return match[1];
          }
        }
      }
      
      // Try to find any cite link
      const citeMatch = responseText.match(/\/scholar\?q=info:([^:]+):scholar\.google\.com/);
      if (citeMatch) {
        return citeMatch[1];
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting paper ID:', error);
      return null;
    }
  },

  /**
   * Get BibTeX citation from paper ID
   * @param {string} paperId - Google Scholar paper ID
   */
  async getBibTexFromPaperId(paperId) {
    try {
      const citeUrl = `https://scholar.google.com/scholar?output=gsb-cite&hl=en&q=info:${paperId}:scholar.google.com/`;
      console.log('Getting citations from:', citeUrl);
      
      const citeResponse = await fetch(citeUrl);
      if (!citeResponse.ok) {
        throw new Error('Citation request failed');
      }
      
      const citeText = await citeResponse.text();
      
      // Try to parse citation response
      try {
        const citeData = JSON.parse(citeText);
        if (citeData && citeData.i && citeData.i[0] && citeData.i[0].l === "BibTeX") {
          const bibTexUrl = citeData.i[0].u;
          console.log('Found BibTeX URL:', bibTexUrl);
          
          // Open the BibTeX page directly
          await chrome.tabs.create({ url: bibTexUrl });
          
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'icons/icon32.png',
            title: 'SelectCite Success!',
            message: 'BibTeX citation page opened! Copy the citation from the new tab.'
          });
          
          return;
        }
      } catch (parseError) {
        // If JSON parsing fails, try HTML parsing
        const bibTexMatch = citeText.match(/href="([^"]*)"[^>]*>BibTeX<\/a>/);
        if (bibTexMatch) {
          const bibTexUrl = bibTexMatch[1];
          console.log('Found BibTeX URL via HTML parsing:', bibTexUrl);
          
          await chrome.tabs.create({ url: bibTexUrl });
          
          chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'icons/icon32.png',
            title: 'SelectCite Success!',
            message: 'BibTeX citation page opened! Copy the citation from the new tab.'
          });
          
          return;
        }
      }
      
      // If we can't find BibTeX link, open the citation page
      await chrome.tabs.create({ url: citeUrl });
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon32.png',
        title: 'SelectCite',
        message: 'Citation page opened. Please click on "BibTeX" link.'
      });
      
    } catch (error) {
      console.error('Error getting BibTeX:', error);
      throw error;
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