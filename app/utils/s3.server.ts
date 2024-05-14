import { PassThrough } from "stream";
import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { UploadHandler } from "@remix-run/node";
import { writeAsyncIterableToWritable } from "@remix-run/node";
import { Resource } from "sst";

//https://github.com/remix-run/examples/issues/163
const uploadStream = ({ Key }: Pick<PutObjectCommandInput, "Key">) => {
  const s3 = new S3Client({});
  const pass = new PassThrough();

  return {
    writeStream: pass,
    promise: new Upload({
      client: s3,
      params: {
        Body: pass,
        Bucket: Resource.Media.name,
        Key,
      },
    }).done(),
  };
};

export async function uploadStreamToS3(data: any, filename: string) {
  const stream = uploadStream({
    Key: filename,
  });

  await writeAsyncIterableToWritable(data, stream.writeStream);

  const file = await stream.promise;
  return file.Location;
}

export const s3UploadHandler: UploadHandler = async ({
  name,
  filename,
  data,
}) => {
  if (name !== "img") {
    return undefined;
  }

  const uploadedFileLocation = await uploadStreamToS3(data, filename!);
  return uploadedFileLocation;
};
