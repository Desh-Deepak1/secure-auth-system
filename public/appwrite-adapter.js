(function () {
  const realFetch = window.fetch.bind(window);

  function json(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function getAppwriteConfig() {
    return {
      endpoint: document.getElementById('awEndpoint').value,
      project: document.getElementById('awProjectId').value,
      database: document.getElementById('awDatabaseId').value,
      collection: document.getElementById('awFilesCollectionId').value
    };
  }

  function initAppwrite() {
    const config = getAppwriteConfig();
    const client = new Appwrite.Client()
      .setEndpoint(config.endpoint)
      .setProject(config.project);
    return {
      account: new Appwrite.Account(client),
      databases: new Appwrite.Databases(client),
      config
    };
  }

  window.fetch = async function (input, init) {
    const modeToggle = document.querySelector('input[name="backendMode"]:checked');
    if (!modeToggle || modeToggle.value !== 'appwrite') {
      return realFetch(input, init);
    }

    const urlStr = typeof input === "string" ? input : input.url;
    
    if (urlStr.includes('appwrite.io')) {
      return realFetch(input, init);
    }

    const pathname = new URL(urlStr, window.location.href).pathname;
    const method = init && init.method ? init.method.toUpperCase() : "GET";
    const reqBody = init && init.body ? JSON.parse(init.body) : null;

    const { account, databases, config } = initAppwrite();

    try {
      if (pathname === "/register" && method === "POST") {
        const user = await account.create(Appwrite.ID.unique(), reqBody.email, reqBody.password);
        return json(201, { id: user.$id, email: user.email });
      }

      if (pathname === "/login" && method === "POST") {
        try {
          await account.createEmailPasswordSession(reqBody.email, reqBody.password);
          const user = await account.get();
          return json(200, { token: "appwrite-session-cookie", user: { id: user.$id, email: user.email } });
        } catch (loginError) {
          return json(401, { error: "Invalid email or password" });
        }
      }

      if (pathname === "/logout" && method === "POST") {
        await account.deleteSession('current');
        return json(200, { message: "Logged out successfully" });
      }

      if (pathname === "/me" && method === "GET") {
        const user = await account.get();
        return json(200, { id: user.$id, email: user.email });
      }

      if (pathname === "/files" && method === "GET") {
        const res = await databases.listDocuments(config.database, config.collection);
        const files = res.documents.map(d => ({
          id: d.$id,
          ownerId: d.ownerId,
          fileName: d.fileName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes
        }));
        return json(200, { files });
      }

      const fileIdMatch = pathname.match(/^\/files\/([^/]+)$/);
      if (fileIdMatch && method === "GET") {
        const res = await databases.getDocument(config.database, config.collection, fileIdMatch[1]);
        return json(200, {
          file: {
            id: res.$id,
            ownerId: res.ownerId,
            fileName: res.fileName,
            mimeType: res.mimeType,
            sizeBytes: res.sizeBytes
          }
        });
      }

      const downloadMatch = pathname.match(/^\/files\/([^/]+)\/download$/);
      if (downloadMatch && method === "GET") {
        const res = await databases.getDocument(config.database, config.collection, downloadMatch[1]);
        const simulatedContent = `This is a simulated download for Appwrite file: "${res.fileName}"`;
        return new Response(simulatedContent, { status: 200, headers: { "Content-Type": "text/plain" } });
      }

      return json(404, { error: "Route not found" });
    } catch (err) {
      return json(err.code || 500, { error: "APPWRITE ERROR: " + err.message });
    }
  };
})();