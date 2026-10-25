// Load environment variables before running checks
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore
  }
}

async function runSheetsCheck() {
  console.log("Checking Google Sheets connection...\n");

  // Step 1: Environment Variables Presence
  process.stdout.write("1. Environment variables check... ");
  const requiredVars = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_SHEET_ID",
  ];

  const missing: string[] = [];
  const present: string[] = [];

  for (const varName of requiredVars) {
    const val = process.env[varName];
    if (val && val.trim().length > 0) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.log("FAIL");
    console.error(`\nMissing required variables: ${missing.join(", ")}`);
    console.error(`Present variables: ${present.join(", ")} (values omitted for security)`);
    console.error("Actionable hint: Ensure all three Google variables are defined in .env.local.");
    process.exit(1);
  }

  console.log(`PASS (${present.join(", ")} present)`);

  const {
    readGoogleConfig,
    getAccessToken,
    getSpreadsheetTabs,
    addTab,
    deleteTab,
    updateValues,
    getValues,
    SheetsApiError,
  } = await import("../src/lib/google-sheets");

  try {
    readGoogleConfig();
  } catch (err: unknown) {
    console.log("FAIL");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 2: Access Token & Spreadsheet Metadata
  process.stdout.write("2. Authenticate & read spreadsheet metadata... ");
  let tabs;
  try {
    await getAccessToken();
    tabs = await getSpreadsheetTabs();
    console.log(`PASS (Found ${tabs.length} tabs)`);
  } catch (err: unknown) {
    console.log("FAIL");
    if (err instanceof SheetsApiError) {
      console.error(`\nSheets API Error [status ${err.status}]: ${err.safeMessage}`);
      if (err.status === 403) {
        console.error(
          "Actionable hint: Share your Google Sheet with your service account email as 'Editor'."
        );
      } else if (err.status === 404) {
        console.error(
          "Actionable hint: Check that GOOGLE_SHEET_ID matches the ID from your spreadsheet URL."
        );
      }
    } else {
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
      console.error("Actionable hint: Check that GOOGLE_PRIVATE_KEY is a valid RSA private key.");
    }
    process.exit(1);
  }

  // Step 3: Temporary Tab Lifecycle (Create, Write, Read, Delete)
  process.stdout.write("3. Temporary tab lifecycle (_connection_test write/read/cleanup)... ");
  const tempTabTitle = "_connection_test";
  let createdGid: number | null = null;

  try {
    // If _connection_test tab already exists from a prior aborted run, clean it up first
    const existing = tabs.find((t) => t.title === tempTabTitle);
    if (existing) {
      await deleteTab(existing.gid);
    }

    // Create tab
    const added = await addTab(tempTabTitle);
    createdGid = added.gid;

    // Write a cell
    const testValue = "connection_ok";
    await updateValues(`'${tempTabTitle}'!A1`, [[testValue]]);

    // Read it back
    const readBack = await getValues(`'${tempTabTitle}'!A1`);
    const val = readBack?.[0]?.[0];

    if (val !== testValue) {
      throw new Error(`Written value mismatch: expected '${testValue}', received '${val}'`);
    }

    console.log("PASS");
  } catch (err: unknown) {
    console.log("FAIL");
    if (err instanceof SheetsApiError) {
      console.error(`\nSheets API Error [status ${err.status}]: ${err.safeMessage}`);
    } else {
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(1);
  } finally {
    // Cleanup temporary tab
    if (createdGid !== null) {
      try {
        await deleteTab(createdGid);
      } catch (cleanupErr: unknown) {
        console.error(
          "Warning: Failed to delete temporary tab:",
          cleanupErr instanceof Error ? cleanupErr.message : cleanupErr
        );
      }
    }
  }

  console.log("\n🎉 GOOGLE SHEETS CONNECTION VERIFIED SUCCESSFULLY!");
}

runSheetsCheck().catch((err) => {
  console.error("Fatal error during sheets check:", err);
  process.exit(1);
});
