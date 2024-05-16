import { PassThrough } from "stream";
import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { writeAsyncIterableToWritable } from "@remix-run/node";
import { Resource } from "sst";

type UploadStreamProps = {
  Key: Pick<PutObjectCommandInput, "Key">["Key"];
  bucketName: Bucket;
};
//https://github.com/remix-run/examples/issues/163
const uploadStream = ({ Key, bucketName }: UploadStreamProps) => {
  const s3 = new S3Client({});
  const pass = new PassThrough();
  return {
    writeStream: pass,
    promise: new Upload({
      client: s3,
      params: {
        Body: pass,
        Bucket: BucketMap[bucketName],
        Key,
      },
    }).done(),
  };
};

export async function uploadStreamToS3(
  data: any,
  filename: string,
  bucketName: Bucket
) {
  const stream = uploadStream({
    Key: filename,
    bucketName,
  });

  await writeAsyncIterableToWritable(data, stream.writeStream);

  const file = await stream.promise;
  return file.Location;
}

export const s3UploadHandler = async ({
  name,
  filename,
  data,
  bucketName,
}: {
  name: string;
  filename?: string;
  data: any;
  bucketName: Bucket;
  contentType?: string;
}) => {
  if (name !== "img") {
    return undefined;
  }

  const uploadedFileLocation = await uploadStreamToS3(
    data,
    filename!,
    bucketName
  );
  return uploadedFileLocation;
};

const BucketMap = {
  media: Resource.Media.name,
  profile: Resource.Profile.name,
} as const;

export type Bucket = keyof typeof BucketMap;
