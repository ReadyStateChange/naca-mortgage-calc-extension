import { corsHeaders } from "../utils/cors";
import { getRates as effectRates } from "../services/getRates";
import { Effect, Either } from "effect";

export async function getRates(): Promise<Response> {
  const rateLookup = await Effect.runPromise(Effect.either(effectRates));

  if (Either.isRight(rateLookup)) {
    return new Response(JSON.stringify(rateLookup.right), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } else {
    console.error("Error fetching rates: ", rateLookup.left);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
