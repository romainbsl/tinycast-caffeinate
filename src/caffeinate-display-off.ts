import type { LaunchProps } from "@raycast/api";

import { startFromDurationArgument } from "./lib/actions";

export default async function Command(props: LaunchProps<{ arguments: { duration?: string } }>) {
  await startFromDurationArgument(props.arguments.duration, true);
}
