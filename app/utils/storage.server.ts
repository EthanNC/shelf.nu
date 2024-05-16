import { S3Client } from "@aws-sdk/client-s3";
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
import { extractImageNameFromSupabaseUrl } from "./extract-image-name-from-supabase-url";
import { Logger } from "./logger";
import type { Bucket } from "./s3.server";
import { s3UploadHandler } from "./s3.server";

const label: ErrorLabel = "File storage";

export function getPublicFileURL({
  filename,
  bucketName = "profile-pictures",
}: {
  filename: string;
  bucketName?: string;
}) {
  try {
    const { data } = getSupabaseAdmin()
      .storage.from(bucketName)
      .getPublicUrl(filename);

    return data.publicUrl;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to get public file URL",
      additionalData: { filename, bucketName },
      label,
    });
  }
}

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
  bucketName = "profile-pictures",
}: {
  url: string;
  bucketName?: string;
}) {
  try {
    if (
      !url.startsWith(
        `${SUPABASE_URL}/storage/v1/object/public/profile-pictures/`
      ) ||
      url === ""
    ) {
      throw new ShelfError({
        cause: null,
        message: "Invalid file URL",
        additionalData: { url },
        label,
      });
    }

    const { error } = await getSupabaseAdmin()
      .storage.from(bucketName)
      .remove([url.split(`${bucketName}/`)[1]]);

    if (error) {
      throw error;
    }
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
  bucketName: string;
}) {
  try {
    const path = extractImageNameFromSupabaseUrl({ url, bucketName });
    if (!path) {
      throw new ShelfError({
        cause: null,
        message: "Cannot extract the image path from the URL",
        additionalData: { url, bucketName },
        label,
      });
    }

    const { error } = await getSupabaseAdmin()
      .storage.from(bucketName)
      .remove([path]);

    if (error) {
      throw error;
    }

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
