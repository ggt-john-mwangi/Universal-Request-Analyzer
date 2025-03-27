// URL utilities

// Parse URL to extract domain and path
export function parseUrl(url) {
  try {
    const parsedUrl = new URL(url)
    return {
      domain: parsedUrl.hostname,
      path: parsedUrl.pathname,
      protocol: parsedUrl.protocol,
      port: parsedUrl.port,
      query: parsedUrl.search,
      hash: parsedUrl.hash,
      fullPath: parsedUrl.pathname + parsedUrl.search + parsedUrl.hash,
    }
  } catch (e) {
    return {
      domain: "",
      path: "",
      protocol: "",
      port: "",
      query: "",
      hash: "",
      fullPath: "",
    }
  }
}

// Get base domain (without subdomain)
export function getBaseDomain(domain) {
  try {
    // Split domain by dots
    const parts = domain.split(".")

    // If domain has only two parts (e.g., example.com), return as is
    if (parts.length <= 2) {
      return domain
    }

    // Handle special cases like co.uk, com.au, etc.
    const secondLevelDomains = ["co", "com", "org", "net", "edu", "gov", "mil"]
    const tlds = ["uk", "au", "ca", "nz", "jp", "in", "br", "fr", "de", "ru", "it", "nl", "es", "cn"]

    if (
      parts.length > 2 &&
      secondLevelDomains.includes(parts[parts.length - 2]) &&
      tlds.includes(parts[parts.length - 1])
    ) {
      // Return last three parts (e.g., example.co.uk)
      return parts.slice(-3).join(".")
    }

    // Return last two parts (e.g., example.com)
    return parts.slice(-2).join(".")
  } catch (e) {
    return domain
  }
}

// Check if URL is valid
export function isValidUrl(url) {
  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

// Get URL without query parameters
export function getUrlWithoutQuery(url) {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.origin + parsedUrl.pathname
  } catch (e) {
    return url
  }
}

// Get query parameters as object
export function getQueryParams(url) {
  try {
    const parsedUrl = new URL(url)
    const params = {}

    for (const [key, value] of parsedUrl.searchParams.entries()) {
      params[key] = value
    }

    return params
  } catch (e) {
    return {}
  }
}

// Build URL from parts
export function buildUrl(parts) {
  try {
    const url = new URL(parts.protocol || "https:", "https://example.com")
    url.hostname = parts.domain || "example.com"
    url.pathname = parts.path || ""
    url.search = parts.query || ""
    url.hash = parts.hash || ""

    if (parts.port) {
      url.port = parts.port
    }

    return url.toString()
  } catch (e) {
    return ""
  }
}

// Sanitize URL for display
export function sanitizeUrl(url, maxLength = 50) {
  if (!url) return ""

  try {
    // Try to parse URL
    const parsedUrl = new URL(url)

    // Build display URL
    let displayUrl = parsedUrl.hostname

    if (parsedUrl.pathname !== "/") {
      displayUrl += parsedUrl.pathname
    }

    // Truncate if too long
    if (displayUrl.length > maxLength) {
      displayUrl = displayUrl.substring(0, maxLength - 3) + "..."
    }

    return displayUrl
  } catch (e) {
    // If URL is invalid, just truncate
    if (url.length > maxLength) {
      return url.substring(0, maxLength - 3) + "..."
    }

    return url
  }
}

