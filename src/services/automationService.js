const { db } = require('../db/database');

class AutomationService {
  async executeAutomation({ method, url, headers, body, checklistId, itemId, itemTitle }, actingUser, ipAddress) {
    if (!url) {
      throw new Error('Automation URL is required.');
    }

    const httpMethod = (method || 'GET').toUpperCase();
    let parsedHeaders = {};
    if (typeof headers === 'string' && headers.trim()) {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch (e) {
        // Simple key: value line parser fallback
        const lines = headers.split('\n');
        for (const line of lines) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim();
            if (key) parsedHeaders[key] = val;
          }
        }
      }
    } else if (typeof headers === 'object' && headers !== null) {
      parsedHeaders = headers;
    }

    const startTime = Date.now();
    let responseStatus = 0;
    let responseBody = '';
    let responseHeaders = {};
    let isSuccess = false;
    let errorDetail = null;

    try {
      const fetchOptions = {
        method: httpMethod,
        headers: parsedHeaders,
        signal: AbortSignal.timeout(15000) // 15 second timeout
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod) && body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const res = await fetch(url, fetchOptions);
      responseStatus = res.status;
      isSuccess = res.ok;

      // Extract response headers
      res.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      const text = await res.text();
      responseBody = text.slice(0, 5000); // cap output at 5KB preview
    } catch (err) {
      errorDetail = err.message || 'Network request failed';
      responseStatus = 0;
      isSuccess = false;
    }

    const durationMs = Date.now() - startTime;

    db.audit.log({
      userId: actingUser.id,
      username: actingUser.username,
      actionType: 'AUTOMATION',
      actionName: 'AUTOMATION_EXECUTED',
      details: {
        checklistId,
        itemId,
        itemTitle,
        method: httpMethod,
        url,
        status: responseStatus,
        durationMs,
        success: isSuccess,
        error: errorDetail
      },
      ipAddress
    });

    return {
      success: isSuccess,
      status: responseStatus,
      durationMs,
      headers: responseHeaders,
      bodyPreview: responseBody,
      error: errorDetail,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AutomationService();
