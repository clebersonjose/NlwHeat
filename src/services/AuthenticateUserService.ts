import axios from 'axios';
import { sign } from 'jsonwebtoken';
import prismaClient from '../prisma';

interface AccessTokenResponse {
  // eslint-disable-next-line camelcase
  access_token:string
}

interface UserResponse {
  // eslint-disable-next-line camelcase
  avatar_url: string,
  login: string,
  id: number,
  name: string
}

export default class AuthenticateUserService {
  execute = async (code: string) => {
    const url = 'https://github.com/login/oauth/access_token';

    const { data: accessTokenResponse } = await axios.post<AccessTokenResponse>(url, null, {
      params: {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      headers: {
        Accept: 'application/json',
      },
    });

    const response = await axios.get<UserResponse>('https://api.github.com/user', {
      headers: {
        authorization: `Bearer ${accessTokenResponse.access_token}`,
      },
    });

    const {
      // eslint-disable-next-line camelcase
      login, id, avatar_url, name,
    } = response.data;

    let user = await prismaClient.user.findFirst({
      where: {
        github_id: id,
      },
    });

    if (!user) {
      user = await prismaClient.user.create({
        data: {
          github_id: id,
          login,
          avatar_url,
          name,
        },
      });
    }

    const token = sign(
      {
        user: {
          name: user.name,
          avatar_url: user.avatar_url,
          id: user.id,
        },
      },
      process.env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: '1d',
      },
    );

    return { token, user };
  }
}
