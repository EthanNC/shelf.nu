import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { parseUrl } from "@aws-sdk/url-parser";
import { formatUrl } from "@aws-sdk/util-format-url";
import {
  unstable_composeUploadHandlers,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import type { ResizeOptions } from "sharp";
import { getSupabaseAdmin } from "~/integrations/supabase/client";
import { cropImage } from "./crop-image";
import { SUPABASE_URL } from "./env";
import type { ErrorLabel } from "./error";
import { ShelfError } from "./error";
import { Logger } from "./logger";
import type { Bucket } from "./s3.server";
import { BucketMap, s3UploadHandler } from "./s3.server";

const label: ErrorLabel = "File storage";

export async function createSignedUrl({ s3Url }: { s3Url: string }) {
  try {
    const client = new S3Client({});
    const s3ObjectUrl = parseUrl(s3Url);
    const presigner = new S3RequestPresigner({
      ...client.config,
    });
    // Create a GET request from S3 url.
    const url = await presigner.presign(new HttpRequest(s3ObjectUrl), {
      expiresIn: 86400,
    });
    return formatUrl(url);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while creating a signed URL. Please try again. If the issue persists contact support.",
      additionalData: { url: s3Url },
      label,
    });
  }
}

export interface UploadOptions {
  bucketName: string;
  filename: string;
  contentType: string;
  resizeOptions?: ResizeOptions;
}

export async function parseFileFormData({
  request,
  newFileName,
  resizeOptions,
  bucketName = "media",
}: {
  request: Request;
  newFileName: string;
  bucketName?: Bucket;
  resizeOptions?: ResizeOptions;
}) {
  try {
    const uploadHandler = unstable_composeUploadHandlers(
      async ({ contentType, data, filename }) => {
        if (!contentType?.includes("image")) {
          return undefined;
        }

        const fileExtension = filename?.split(".").pop();
        const image = await cropImage(data, resizeOptions);
        const uploadedFilePath = await s3UploadHandler({
          name: "img",
          filename: `${newFileName}.${fileExtension}`,
          contentType,
          data: image,
          bucketName,
        });

        return uploadedFilePath;
      }
    );

    const formData = await unstable_parseMultipartFormData(
      request,
      uploadHandler
    );

    return formData;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while uploading the file. Please try again or contact support.",
      label,
    });
  }
}

export async function deleteProfilePicture({
  url,
  bucketName = "profile",
}: {
  url: string;
  bucketName?: Bucket;
}) {
  const client = new S3Client({});

  const path = new URL(url).pathname.slice(1);
  const command = new DeleteObjectCommand({
    Bucket: BucketMap[bucketName],
    Key: path,
  });

  try {
    await client.send(command);
  } catch (cause) {
    Logger.error(
      new ShelfError({
        cause,
        message: "Fail to delete the profile picture",
        additionalData: { url, bucketName },
        label,
      })
    );
  }
}

export async function deleteAssetImage({
  url,
  bucketName,
}: {
  url: string;
  bucketName: Bucket;
}) {
  const client = new S3Client({});

  const path = new URL(url).pathname.slice(1);
  const command = new DeleteObjectCommand({
    Bucket: BucketMap[bucketName],
    Key: path,
  });

  try {
    await client.send(command);
    return true;
  } catch (cause) {
    Logger.error(
      new ShelfError({
        cause,
        message: "Fail to delete the asset image",
        additionalData: { url, bucketName },
        label,
      })
    );
  }
}
