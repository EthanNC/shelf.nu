import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { db } from "~/database/db.server";
import { getSelectedOrganisation } from "~/modules/organization/context.server";
import { makeShelfError } from "~/utils/error";
import { data, error, parseData } from "~/utils/http.server";

const BasicModelFilters = z.object({
  /** key of field for which we have to filter values */
  queryKey: z.string(),

  /** Actual value */
  queryValue: z.string().optional(),

  /** What user have already selected, so that we can exclude them */
  selectedValues: z.string().optional(),
});

/**
 * The schema used for each different model.
 * To allow filtersing and searching on different models update the schema for the relevant model
 */
export const ModelFiltersSchema = z.discriminatedUnion("name", [
  BasicModelFilters.extend({
    name: z.literal("asset"),
  }),
  BasicModelFilters.extend({
    name: z.literal("tag"),
  }),
  BasicModelFilters.extend({
    name: z.literal("category"),
  }),
  BasicModelFilters.extend({
    name: z.literal("location"),
  }),
  BasicModelFilters.extend({
    name: z.literal("teamMember"),
    deletedAt: z.string().nullable().optional(),
  }),
]);

export type AllowedModelNames = z.infer<typeof ModelFiltersSchema>["name"];
export type ModelFilters = z.infer<typeof ModelFiltersSchema>;

export async function loader({ context, request }: LoaderFunctionArgs) {
  const authSession = context.session;
  const { userId } = authSession;

  try {
    const { organizationId } = await getSelectedOrganisation({
      userId,
      request,
    });

    /** Getting all the query parameters from url */
    const url = new URL(request.url);
    const searchParams: Record<string, any> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (value === "null") {
        searchParams[key] = null;
      } else {
        searchParams[key] = value;
      }
    }

    /** Validating parameters */
    const { name, queryKey, queryValue, selectedValues, ...filters } =
      parseData(searchParams, ModelFiltersSchema);

    const queryData = (await db[name].dynamicFindMany({
      where: {
        organizationId,
        OR: [
          {
            [queryKey]: {
              contains: queryValue,
              mode: "insensitive",
            },
          },
          {
            id: { in: (selectedValues ?? "").split(",") },
          },
        ],
        ...filters,
      },
    })) as Array<Record<string, string>>;

    return json(
      data({
        filters: queryData.map((item) => ({
          id: item.id,
          name: item[queryKey],
          color: item?.color,
          metadata: item,
        })),
      })
    );
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    return json(error(reason), { status: reason.status });
  }
}
