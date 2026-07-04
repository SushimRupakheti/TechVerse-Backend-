// import { Request, Response, NextFunction } from 'express';
// import { UserRepository } from '../repositories/auth.repository';
// import { IUser } from '../models/user.model';
// import jwt from 'jsonwebtoken';
// import { HttpError } from '../errors/http-error';
// import { JWT_SECRET } from '../config';





// let userRepository = new UserRepository();
// declare global {
//     namespace Express {
//         interface Request {
//             user?: Record<string, any> | IUser
//         }
//     }
// }


// export async function authorizedMiddleWare(req: Request, res: Response, next: NextFunction) {

//     //express funtion can have next funtion to go to next 
//     // if(req.headers && req.headers.authorization){
//     //     return next();
//     // }
//     // return res.status(401).json(
//     //     {success:false,message:"unauthorized"}
//     // )

//     try {
//         const authHeader = req.headers.authorization;
//         if (!authHeader || !authHeader.startsWith("Bearer "))
//             throw new HttpError(401, "unauthorized ,No bearer token");

//         const token = authHeader.split(" ")[1];
//         if (!token)
//             throw new HttpError(401, "unauthorized ,missing token");

//         const decoded = jwt.verify(token, JWT_SECRET) as Record<string, any>; // decoded -> payload
//         if (!decoded || !decoded.id)
//             throw new HttpError(401, "Unauthorized, Invalid Token");

//         const user = await userRepository.getUserById(decoded.id); // make function async
//         if (!user)
//             throw new HttpError(401, "Unauthorized, User Not Found");

//         req.user = user;
//         return next();

//     } catch (err: Error | any) {
//         return res.status(500).json(
//             { success: false, message: err.message || "unauthorized" }
//         )
//     }


// }

// export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
//     try{
//         // req.user is set in authorizedMiddelWare
//         // only use role/admin middleware after user is authorized
//         if(!req.user)
//             throw new HttpError( 401, "Unauthorized, User Not Found" );
        
//         if(req.user.role !== 'admin')
//             throw new HttpError( 403, "Forbidden, Admins Only" );
        
//         return next();
//     }catch(err: Error | any){
//         return res.status(err.statusCode || 500 ).json(
//             { success: false, message: err.message || "Unauthorized" }
//         )
//     }
// }
import { Request, Response, NextFunction } from "express";
import { UserRepository } from "../repositories/auth.repository";
import { IUser } from "../models/user.model";
import jwt from "jsonwebtoken";
import { HttpError } from "../errors/http-error";
import { JWT_SECRET } from "../config";

let userRepository = new UserRepository();

declare global {
  namespace Express {
    interface Request {
      user?: Record<string, any> | IUser;
    }
  }
}

function cleanToken(token: string) {
  let t = (token || "").trim();

  // remove wrapping quotes if token is like "eyJ..." or 'eyJ...'
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  // if someone mistakenly sends "Bearer eyJ..." as token part
  if (t.toLowerCase().startsWith("bearer ")) {
    t = t.slice(7).trim();
  }

  return t;
}

function looksLikeJwt(token: string) {
  // jwt must contain exactly 2 dots: header.payload.signature
  return token.split(".").length === 3;
}

export async function authorizedMiddleWare(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpError(401, "unauthorized ,No bearer token");
    }

    // IMPORTANT:
    // If header becomes "Bearer Bearer eyJ..." then split(" ")[1] = "Bearer" (wrong)
    // So take everything after first "Bearer "
    const rawToken = authHeader.slice(7); // removes first "Bearer "
    const token = cleanToken(rawToken);

    if (!token) throw new HttpError(401, "unauthorized ,missing token");
    if (!looksLikeJwt(token))
      throw new HttpError(401, "Unauthorized, Invalid Token Format");

    if (!JWT_SECRET) {
      throw new HttpError(500, "JWT_SECRET not configured");
    }

    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, any>;

    if (!decoded || !decoded.id) {
      throw new HttpError(401, "Unauthorized, Invalid Token");
    }

    const user = await userRepository.getUserById(decoded.id);
    if (!user) {
      throw new HttpError(401, "Unauthorized, User Not Found");
    }

    req.user = user;
    return next();
  } catch (err: any) {
    // jwt errors should be 401 (not 500)
    if (
      err?.name === "JsonWebTokenError" ||
      err?.name === "TokenExpiredError" ||
      err?.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message: err.message || "unauthorized",
      });
    }

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "unauthorized",
    });
  }
}

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, "Unauthorized, User Not Found");

    // req.user is IUser or Record<string,any>
    const role = (req.user as any).role;

    if (role !== "admin") throw new HttpError(403, "Forbidden, Admins Only");

    return next();
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Unauthorized",
    });
  }
}
