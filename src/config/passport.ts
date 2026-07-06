import passport from "passport";
import { Profile, Strategy as GoogleStrategy, VerifyCallback } from "passport-google-oauth20";
import {
  BACKEND_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from ".";
import { UserModel } from "../models/user.model";

export const configurePassport = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("Google OAuth credentials are not configured");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL}/api/auth/google/callback`,
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();

          if (!email) {
            return done(new Error("Google account does not have a verified email"));
          }

          const existingUser = await UserModel.findOne({ email });

          if (existingUser) {
            if (!existingUser.googleId) {
              existingUser.googleId = profile.id;
            }

            if (!existingUser.authProvider) {
              existingUser.authProvider = "local";
            }

            await existingUser.save();
            return done(null, existingUser);
          }

          const nameParts = profile.displayName?.trim().split(/\s+/) || [];
          const firstName = profile.name?.givenName || nameParts[0] || "Google";
          const lastName = profile.name?.familyName || nameParts.slice(1).join(" ");

          const newUser = await UserModel.create({
            firstName,
            lastName,
            email,
            googleId: profile.id,
            authProvider: "google",
            role: "customer",
            profileImage: profile.photos?.[0]?.value || null,
          });

          return done(null, newUser);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
};
