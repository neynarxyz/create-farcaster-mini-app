import {
  encodedJsonFarcasterSignatureSchema,
  eventPayloadSchema,
  jsonFarcasterSignatureHeaderSchema,
} from "@farcaster/frame-sdk";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const requestJson = await request.json();

  const requestBody =
    encodedJsonFarcasterSignatureSchema.safeParse(requestJson);

  if (requestBody.success === false) {
    return Response.json(
      { success: false, errors: requestBody.error.errors },
      { status: 400 }
    );
  }

  // TODO: verify signature

  const headerData = JSON.parse(
    Buffer.from(requestBody.data.header, "base64url").toString("utf-8")
  );
  const header = jsonFarcasterSignatureHeaderSchema.safeParse(headerData);
  if (header.success === false) {
    return Response.json(
      { success: false, errors: header.error.errors },
      { status: 400 }
    );
  }
  const fid = header.data.fid;

  const payloadData = JSON.parse(
    Buffer.from(requestBody.data.payload, "base64url").toString("utf-8")
  );
  const payload = eventPayloadSchema.safeParse(payloadData);

  if (payload.success === false) {
    return Response.json(
      { success: false, errors: payload.error.errors },
      { status: 400 }
    );
  }

  switch (payload.data.event) {
    case "frame_added":
      console.log(
        payload.data.notificationDetails
          ? `Got frame-added event for fid ${fid} with notification token ${payload.data.notificationDetails.token} and url ${payload.data.notificationDetails.url}`
          : `Got frame-added event for fid ${fid} with no notification details`
      );
      break;
    case "frame_removed":
      console.log(`Got frame-removed event for fid ${fid}`);
      break;
    case "notifications_enabled":
      console.log(
        `Got notifications-enabled event for fid ${fid} with token ${
          payload.data.notificationDetails.token
        } and url ${payload.data.notificationDetails.url} ${JSON.stringify(
          payload.data
        )}`
      );
      break;
    case "notifications_disabled":
      console.log(`Got notifications-disabled event for fid ${fid}`);
      break;
  }

  return Response.json({ success: true });
}
