import {
  ParseWebhookEvent,
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/miniapp-node";
import { NextRequest } from "next/server";
import { APP_NAME } from "~/lib/constants";
import {
  deleteUserNotificationDetails,
  setUserNotificationDetails,
} from "~/lib/kv";
import { sendMiniAppNotification } from "~/lib/notifs";

export async function POST(request: NextRequest) {
  // If Neynar is enabled, we don't need to handle webhooks here
  // as they will be handled by Neynar's webhook endpoint
  const neynarEnabled = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID;
  if (neynarEnabled) {
    return Response.json({ success: true });
  }

  const requestJson = await request.json();

  let data;
  try {
    data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;

    switch (error.name) {
      case "VerifyJsonFarcasterSignature.InvalidDataError":
      case "VerifyJsonFarcasterSignature.InvalidEventDataError":
        // The request data is invalid
        return Response.json(
          { success: false, error: error.message },
          { status: 400 }
        );
      case "VerifyJsonFarcasterSignature.InvalidAppKeyError":
        // The app key is invalid
        return Response.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      case "VerifyJsonFarcasterSignature.VerifyAppKeyError":
        // Internal error verifying the app key (caller may want to try again)
        return Response.json(
          { success: false, error: error.message },
          { status: 500 }
        );
    }
  }

  const fid = data.fid;
  const event = data.event;

  // Only handle notifications if Neynar is not enabled
  // When Neynar is enabled, notifications are handled through their webhook
  switch (event.event) {
    case "miniapp_added":
      if (event.notificationDetails) {
        await setUserNotificationDetails(fid, event.notificationDetails);
        await sendMiniAppNotification({
          fid,
          title: `Welcome to ${APP_NAME}`,
          body: "Mini app is now added to your client",
        });
      } else {
        await deleteUserNotificationDetails(fid);
      }
      break;

    case "miniapp_removed":
      await deleteUserNotificationDetails(fid);
      break;

    case "notifications_enabled":
      await setUserNotificationDetails(fid, event.notificationDetails);
      await sendMiniAppNotification({
        fid,
        title: `Welcome to ${APP_NAME}`,
        body: "Notifications are now enabled",
      });
      break;

    case "notifications_disabled":
      await deleteUserNotificationDetails(fid);
      break;
  }

  return Response.json({ success: true });
}
